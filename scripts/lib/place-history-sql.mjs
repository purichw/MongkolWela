import { importPlaceHistories } from "./place-history-import.mjs";
import { templeDatasets } from "../../src/lib/temple-routing.js";
import { createLegacyTempleSlug } from "../../src/data/temple-slugs.js";
import { createHash } from "node:crypto";

// Browser SQL Editor transport for the same reviewed import, without exporting
// credentials. The transaction locks and checks the live revision before merging.
function historyImportPayload(histories, reviewedAt) {
  const { report } = importPlaceHistories({}, histories, { reviewedAt });
  const payload = {
    histories: Object.fromEntries(histories.map(row => [row.key, {
      description: row.description.trim(),
      research: { key: row.canonicalKey || row.key, reviewedAt, importedDescription: row.description.trim(), sources: row.sources, factNotes: row.factNotes || [] },
    }])),
    records: Object.entries(templeDatasets).flatMap(([collection, rows]) => rows.map(row => ({ key: `${collection}:${createLegacyTempleSlug(row)}`, collection, historyKey: `${row.name}|${row.province}`.normalize("NFC") }))),
  };
  if (payload.records.some(row => !row.historyKey)) throw new Error("Missing history mapping");
  return { payload, report };
}

export function placeHistoryImportSql(histories, checksum, reviewedAt = "2026-10-26", { stagedPayload } = {}) {
  if (!/^[a-f0-9]{32}$/.test(checksum)) throw new Error("Expected the current database content checksum");
  const { payload, report } = historyImportPayload(histories, reviewedAt);
  const json = JSON.stringify(payload);
  if (json.includes("$place_history_data$")) throw new Error("Unsafe SQL literal delimiter");
  return `-- Reviewed place histories: ${report.places} identities, ${report.memberships} memberships.
-- Atomic merge; existing fields, media, slugs, status and ordering are preserved.
DO $place_history_import$
DECLARE
  payload jsonb := ${stagedPayload || `$place_history_data$${json}$place_history_data$::jsonb`};
  before_content jsonb;
  next_content jsonb;
  old_record jsonb;
  next_record jsonb;
  mapping jsonb;
  history jsonb;
  record_key text;
  stamp text := to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
  before_content := (SELECT content FROM public.cms_documents WHERE id = 'live' AND status = 'published' FOR UPDATE);
  IF before_content IS NULL THEN RAISE EXCEPTION 'Published CMS document not found'; END IF;
  IF md5(before_content::text) <> '${checksum}' THEN
    RAISE EXCEPTION 'CMS changed since review. Nothing imported; inspect the latest revision.';
  END IF;
  IF jsonb_array_length(payload->'records') <> 625 OR (SELECT count(*) FROM jsonb_object_keys(payload->'histories')) <> 378 THEN
    RAISE EXCEPTION 'Incomplete history import';
  END IF;
  next_content := jsonb_set(before_content, '{temples}', coalesce(before_content->'temples', '{}'::jsonb), true);
  next_content := jsonb_set(next_content, '{temples,records}', coalesce(next_content#>'{temples,records}', '{}'::jsonb), true);
  FOR mapping IN SELECT value FROM jsonb_array_elements(payload->'records') LOOP
    record_key := mapping->>'key';
    history := payload->'histories'->(mapping->>'historyKey');
    old_record := coalesce(before_content#>ARRAY['temples','records',record_key], before_content#>ARRAY['temples','overrides',record_key], '{}'::jsonb);
    IF (old_record->'fields') ? 'description'
       AND old_record#>>'{fields,description}' IS DISTINCT FROM history->>'description'
       AND old_record#>>'{fields,description}' IS DISTINCT FROM old_record#>>'{historyResearch,importedDescription}' THEN
      RAISE EXCEPTION 'Admin history conflict: %', record_key;
    END IF;
    next_record := old_record || jsonb_build_object(
      'key', record_key, 'collection', mapping->>'collection', 'source', coalesce(old_record->>'source','dataset'),
      'fields', coalesce(old_record->'fields','{}'::jsonb) || jsonb_build_object('description',history->>'description'),
      'historyResearch', history->'research');
    next_content := jsonb_set(next_content, ARRAY['temples','records',record_key], next_record, true);
  END LOOP;
  next_content := next_content || jsonb_build_object('publishedAt',stamp,'updatedAt',stamp,'publishedBy','curated-place-history-import');
  INSERT INTO public.cms_revisions(document_id,content,schema_version,actor,source,published_at)
    VALUES ('live',before_content,coalesce((before_content->>'schemaVersion')::integer,1),'curated-place-history-import','history-import-before',now());
  UPDATE public.cms_documents SET content=next_content,published_at=stamp::timestamptz,updated_at=stamp::timestamptz,published_by='curated-place-history-import' WHERE id='live';
  INSERT INTO public.cms_revisions(document_id,content,schema_version,actor,source,published_at)
    VALUES ('live',next_content,coalesce((next_content->>'schemaVersion')::integer,1),'curated-place-history-import','curated-place-history-import',stamp::timestamptz);
  INSERT INTO public.admin_audit_events(actor,event_type,metadata)
    VALUES ('curated-place-history-import','cms.publish',jsonb_build_object('documentId','live','source','curated-place-history-import','places',378,'memberships',625,'previousChecksum','${checksum}'));
END
$place_history_import$;
SELECT content->>'publishedAt' AS published_at,
  (SELECT count(*) FROM jsonb_each(content#>'{temples,records}') item WHERE item.value ? 'historyResearch') AS histories_published,
  md5(content::text) AS content_checksum
FROM public.cms_documents WHERE id='live';
`;
}

// Supabase's browser editor caps query size. Stage bounded chunks in an RLS-locked
// table, then verify every checksum before the single atomic live publication.
export function placeHistoryImportBatches(histories, checksum, { reviewedAt = "2026-10-26", runId = `curated-history-${reviewedAt.replaceAll("-", "")}`, maxBytes = 48000 } = {}) {
  if (!/^[a-z0-9-]{1,80}$/.test(runId)) throw new Error("Invalid import run ID");
  const { payload } = historyImportPayload(histories, reviewedAt);
  const chunks = [];
  let chunk = { histories: {}, records: [] };
  for (const [key, history] of Object.entries(payload.histories)) {
    const records = payload.records.filter(row => row.historyKey === key);
    const candidate = { histories: { ...chunk.histories, [key]: history }, records: [...chunk.records, ...records] };
    if (Buffer.byteLength(JSON.stringify(candidate)) > maxBytes && chunk.records.length) {
      chunks.push(chunk);
      chunk = { histories: { [key]: history }, records };
    } else chunk = candidate;
  }
  if (chunk.records.length) chunks.push(chunk);
  const digests = chunks.map(part => createHash("md5").update(JSON.stringify(part)).digest("hex"));
  const setup = `CREATE TABLE IF NOT EXISTS public.cms_history_import_batches (
    run_id text NOT NULL, part integer NOT NULL, payload text NOT NULL,
    payload_md5 text NOT NULL CHECK (payload_md5 = md5(payload)),
    created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (run_id, part)
  );
  ALTER TABLE public.cms_history_import_batches ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.cms_history_import_batches FROM PUBLIC, anon, authenticated;
  SELECT relrowsecurity FROM pg_class WHERE oid='public.cms_history_import_batches'::regclass;`;
  const parts = chunks.map((part, index) => `DO $stage_history$
    BEGIN
      IF EXISTS (SELECT 1 FROM public.cms_history_import_batches WHERE run_id='${runId}' AND part=${index} AND payload_md5<>'${digests[index]}') THEN
        RAISE EXCEPTION 'Staged part conflicts with this reviewed import';
      END IF;
      INSERT INTO public.cms_history_import_batches(run_id,part,payload,payload_md5)
      VALUES ('${runId}',${index},$place_history_data$${JSON.stringify(part)}$place_history_data$,'${digests[index]}') ON CONFLICT DO NOTHING;
    END $stage_history$;
    SELECT part,payload_md5 FROM public.cms_history_import_batches WHERE run_id='${runId}' AND part=${index};`);
  const expected = digests.map((digest, part) => `(${part},'${digest}')`).join(",");
  const stagedPayload = `(WITH verified AS (
      SELECT s.part,s.payload::jsonb AS payload FROM public.cms_history_import_batches s
      JOIN (VALUES ${expected}) AS expected(part,digest) ON s.part=expected.part AND s.payload_md5=expected.digest
      WHERE s.run_id='${runId}' AND md5(s.payload)=expected.digest
    ) SELECT CASE WHEN (SELECT count(*) FROM verified)=${chunks.length} THEN jsonb_build_object(
      'histories',(SELECT jsonb_object_agg(item.key,item.value) FROM verified CROSS JOIN LATERAL jsonb_each(payload->'histories') item),
      'records',(SELECT jsonb_agg(item.value) FROM verified CROSS JOIN LATERAL jsonb_array_elements(payload->'records') item)
    ) ELSE '{}'::jsonb END)`;
  return { runId, setup, parts, publish: placeHistoryImportSql(histories, checksum, reviewedAt, { stagedPayload }), digests };
}
