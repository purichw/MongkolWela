import { importPlaceHistories } from "./place-history-import.mjs";
import { templeDatasets } from "../../src/lib/temple-routing.js";
import { createLegacyTempleSlug } from "../../src/data/temple-slugs.js";

// Browser SQL Editor transport for the same reviewed import, without exporting
// credentials. The transaction locks and checks the live revision before merging.
export function placeHistoryImportSql(histories, checksum, reviewedAt = "2026-10-26") {
  if (!/^[a-f0-9]{32}$/.test(checksum)) throw new Error("Expected the current database content checksum");
  const { report } = importPlaceHistories({}, histories, { reviewedAt });
  const payload = {
    histories: Object.fromEntries(histories.map(row => [row.key, {
      description: row.description.trim(),
      research: { key: row.canonicalKey || row.key, reviewedAt, importedDescription: row.description.trim(), sources: row.sources, factNotes: row.factNotes || [] },
    }])),
    records: Object.entries(templeDatasets).flatMap(([collection, rows]) => rows.map(row => ({ key: `${collection}:${createLegacyTempleSlug(row)}`, collection, historyKey: `${row.name}|${row.province}`.normalize("NFC") }))),
  };
  if (payload.records.some(row => !row.historyKey)) throw new Error("Missing history mapping");
  const json = JSON.stringify(payload);
  if (json.includes("$place_history_data$")) throw new Error("Unsafe SQL literal delimiter");
  return `-- Reviewed place histories: ${report.places} identities, ${report.memberships} memberships.
-- Atomic merge; existing fields, media, slugs, status and ordering are preserved.
DO $place_history_import$
DECLARE
  payload jsonb := $place_history_data$${json}$place_history_data$::jsonb;
  before_content jsonb;
  next_content jsonb;
  old_record jsonb;
  next_record jsonb;
  mapping jsonb;
  history jsonb;
  record_key text;
  stamp text := to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
  SELECT content INTO STRICT before_content FROM public.cms_documents WHERE id = 'live' AND status = 'published' FOR UPDATE;
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
