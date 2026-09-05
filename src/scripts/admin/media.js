export function createAdminMedia({ markDirty, setStatus, state, api, $, TEMPLE_IMAGE_FIELDS, escapeHtml, currentTempleEdit, currentTempleRecord, renderTemples, templeImageValue }) {
function imageFieldFromButton(button) {
  const root = button.closest("[data-image-role][data-image-viewport]");
  if (!root) return null;
  return {
    root,
    role: root.dataset.imageRole,
    viewport: root.dataset.imageViewport,
    ratio: Number(root.dataset.imageRatio) || 1,
  };
}

function setTempleImage(role, viewport, url, metadata = {}) {
  const edit = currentTempleEdit();
  const catalogRecord = currentTempleRecord();
  if (!edit || !catalogRecord) return;
  edit.images ||= {};
  edit.images[role] ||= {};
  edit.images[role][viewport] = { ...(edit.images[role][viewport] || {}), ...metadata, url };
  catalogRecord.temple.images ||= {};
  catalogRecord.temple.images[role] ||= {};
  catalogRecord.temple.images[role][viewport] = { ...(catalogRecord.temple.images[role][viewport] || {}), ...metadata, url };
  if (role === "card" && viewport === "desktop") catalogRecord.temple.imageUrl = url;
  markDirty();
}

async function useTempleImageUrl(button) {
  const field = imageFieldFromButton(button);
  if (!field) return;
  const input = field.root.querySelector("[data-image-url]");
  const sourceUrl = String(input?.value || "").trim();
  if (!/^https:\/\//iu.test(sourceUrl)) {
    setStatus("กรุณาใช้ HTTPS image URL", "error");
    input?.focus();
    return;
  }
  try {
    setStatus(state.media.provider ? "กำลังตรวจสอบและนำรูปเข้าระบบ..." : "กำลังตรวจสอบลิงก์รูปภาพ...", "info");
    await verifyImageLoads(sourceUrl);
    const result = state.media.provider ? await uploadAdminMedia(sourceUrl, templeImageFilename(field)) : sourceUrl;
    setTempleImage(field.role, field.viewport, result, {
      originalUrl: sourceUrl,
      provider: detectImageProvider(result),
    });
    setStatus("เพิ่มรูปแล้ว กดครอปรูปเพื่อปรับจุดภาพได้", "ok");
    renderTemples();
  } catch (error) {
    field.root.classList.add("is-error");
    setStatus(`ยังไม่บันทึกรูป: ${error.message}`, "error");
  }
}

function verifyImageLoads(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(url);
    image.onerror = () => reject(new Error("URL นี้เปิดเป็นรูปภาพไม่ได้ กรุณาตรวจสอบลิงก์"));
    image.src = url;
  });
}

function cropTempleImage(button) {
  const field = imageFieldFromButton(button);
  if (!field) return;
  const sourceUrl = field.root.querySelector("[data-image-url]")?.value || templeImageValue(currentTempleRecord(), currentTempleEdit({ create: false }), field.role, field.viewport);
  if (!sourceUrl) return;
  openTempleCropper(sourceUrl, field);
}

function reuseTempleImage(button) {
  const field = imageFieldFromButton(button);
  const record = currentTempleRecord();
  const edit = currentTempleEdit({ create: false });
  if (!field || !record) return;
  const candidates = [
    templeImageValue(record, edit, field.role, field.viewport === "mobile" ? "desktop" : "mobile"),
    templeImageValue(record, edit, "card", "desktop"),
    record.temple.imageUrl,
  ].filter(Boolean);
  if (!candidates.length) {
    setStatus("ยังไม่มีรูปต้นทางให้ใช้ซ้ำ", "warn");
    return;
  }
  setTempleImage(field.role, field.viewport, candidates[0], { provider: detectImageProvider(candidates[0]) });
  setStatus("ใช้รูปเดิมแล้ว สามารถครอปแยกสำหรับช่องนี้ได้", "ok");
  renderTemples();
}

function clearTempleImage(button) {
  const field = imageFieldFromButton(button);
  const edit = currentTempleEdit();
  if (!field || !edit) return;
  edit.images ||= {};
  edit.images[field.role] ||= {};
  edit.images[field.role][field.viewport] = { url: "" };
  const record = currentTempleRecord();
  if (record?.temple?.images?.[field.role]) record.temple.images[field.role][field.viewport] = { url: "" };
  markDirty();
  renderTemples();
}

function handleTempleImageUpload(input) {
  const field = imageFieldFromButton(input);
  const file = input.files?.[0];
  if (!field || !file) return;
  if (!file.type.startsWith("image/")) {
    setStatus("ไฟล์ที่เลือกไม่ใช่รูปภาพ", "error");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => openTempleCropper(String(reader.result || ""), { ...field, fileName: file.name });
  reader.onerror = () => setStatus("อ่านไฟล์รูปไม่สำเร็จ", "error");
  reader.readAsDataURL(file);
}

function templeImageFilename(field) {
  const record = currentTempleRecord();
  const safeName = String(record?.temple?.name || "temple")
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return `${safeName || "temple"}-${field.role}-${field.viewport}.jpg`;
}

function detectImageProvider(url = "") {
  if (/res\.cloudinary\.com/iu.test(url)) return "cloudinary";
  if (/ik\.imagekit\.io/iu.test(url) || /imagekit\.io/iu.test(url)) return "imagekit";
  if (/wikimedia\.org|wikipedia\.org/iu.test(url)) return "wikimedia";
  return "external";
}

async function uploadAdminMedia(fileValue, fileName) {
  if (state.media.provider === "cloudinary" && state.media.cloudinary?.enabled) {
    const form = new FormData();
    form.append("file", fileValue);
    form.append("upload_preset", state.media.cloudinary.uploadPreset);
    form.append("folder", "mongkolwela/temples");
    form.append("context", `source=admin_portal|temple=${currentTempleRecord()?.key || ""}`);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${state.media.cloudinary.cloudName}/image/upload`, {
      method: "POST",
      body: form,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.secure_url) throw new Error("อัปโหลดรูปไม่สำเร็จ");
    return payload.secure_url;
  }
  if (state.media.provider === "imagekit" && state.media.imagekit?.enabled) {
    const auth = await api("/api/admin/media", {
      method: "POST",
      body: JSON.stringify({ action: "imagekit-auth" }),
    });
    const form = new FormData();
    form.append("file", fileValue);
    form.append("fileName", fileName || "temple-image.jpg");
    form.append("folder", "/mongkolwela/temples");
    form.append("useUniqueFileName", "true");
    form.append("publicKey", auth.authentication.publicKey);
    form.append("signature", auth.authentication.signature);
    form.append("expire", String(auth.authentication.expire));
    form.append("token", auth.authentication.token);
    const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", { method: "POST", body: form });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.url) throw new Error("อัปโหลดรูปไม่สำเร็จ");
    return payload.url;
  }
  throw new Error("ยังไม่ได้ตั้งค่าระบบอัปโหลดรูป");
}

let templeCropState = null;

function openTempleCropper(src, field) {
  let overlay = $("#templeCropOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "templeCropOverlay";
    overlay.className = "mw-admin-crop-overlay";
    document.body.appendChild(overlay);
  }
  const fieldLabel = TEMPLE_IMAGE_FIELDS.find((item) => item.role === field.role);
  overlay.innerHTML = `<div class="mw-admin-crop-modal" role="dialog" aria-modal="true" aria-labelledby="templeCropTitle">
    <header><div><span>${escapeHtml(field.viewport === "mobile" ? "มือถือ" : "เดสก์ท็อปและแท็บเล็ต")}</span><h2 id="templeCropTitle">ครอปรูป ${escapeHtml(fieldLabel?.label || "รูปภาพ")} · ${escapeHtml(fieldLabel?.ratioLabel || "")}</h2></div><button type="button" data-crop-close aria-label="ปิด">×</button></header>
    <div class="mw-admin-crop-stage">
      <div class="mw-admin-crop-wrap" data-crop-wrap>
        <img ${/^data:/iu.test(src) ? "" : 'crossorigin="anonymous"'} src="${escapeHtml(src)}" alt="" data-crop-image>
        <div class="mw-admin-crop-selection" data-crop-selection><i data-crop-handle="nw"></i><i data-crop-handle="ne"></i><i data-crop-handle="sw"></i><i data-crop-handle="se"></i></div>
      </div>
    </div>
    <footer><p>ลากกรอบเพื่อเลือกภาพ ระบบจะบันทึกเป็น JPEG ตามสัดส่วนที่กำหนด</p><div><button class="mw-admin-btn" type="button" data-crop-close>ยกเลิก</button><button class="mw-admin-btn mw-admin-btn-primary" type="button" data-crop-apply>ครอปและบันทึก</button></div></footer>
  </div>`;
  overlay.classList.add("is-open");
  overlay.querySelectorAll("[data-crop-close]").forEach((button) => button.addEventListener("click", closeTempleCropper));
  overlay.querySelector("[data-crop-apply]")?.addEventListener("click", applyTempleCrop);
  const image = overlay.querySelector("[data-crop-image]");
  image.addEventListener("load", () => initializeTempleCrop(field, src));
  image.addEventListener("error", () => setStatus("โหลดรูปเพื่อครอปไม่สำเร็จ ลองอัปโหลดใหม่", "error"));
  if (image.complete && image.naturalWidth) initializeTempleCrop(field, src);
}

function initializeTempleCrop(field, src) {
  const overlay = $("#templeCropOverlay");
  const image = overlay?.querySelector("[data-crop-image]");
  const selection = overlay?.querySelector("[data-crop-selection]");
  if (!image || !selection) return;
  const width = image.clientWidth;
  const height = image.clientHeight;
  let cropWidth;
  let cropHeight;
  if (width / height > field.ratio) {
    cropHeight = height;
    cropWidth = cropHeight * field.ratio;
  } else {
    cropWidth = width;
    cropHeight = cropWidth / field.ratio;
  }
  templeCropState = {
    ...field,
    src,
    image,
    selection,
    displayWidth: width,
    displayHeight: height,
    x: (width - cropWidth) / 2,
    y: (height - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight,
  };
  updateTempleCropSelection();
  bindTempleCropPointerEvents();
}

function bindTempleCropPointerEvents() {
  const state = templeCropState;
  if (!state) return;
  state.selection.onpointerdown = (event) => {
    event.preventDefault();
    const handle = event.target.dataset.cropHandle || "";
    const start = { x: event.clientX, y: event.clientY, ...pickCropBox(state) };
    state.selection.setPointerCapture?.(event.pointerId);
    const move = (moveEvent) => {
      const dx = moveEvent.clientX - start.x;
      const dy = moveEvent.clientY - start.y;
      if (!handle) moveTempleCrop(start, dx, dy);
      else resizeTempleCrop(handle, start, dx, dy);
      updateTempleCropSelection();
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
}

function pickCropBox(state) {
  return { cropX: state.x, cropY: state.y, cropWidth: state.width, cropHeight: state.height };
}

function moveTempleCrop(start, dx, dy) {
  const state = templeCropState;
  state.x = Math.max(0, Math.min(start.cropX + dx, state.displayWidth - state.width));
  state.y = Math.max(0, Math.min(start.cropY + dy, state.displayHeight - state.height));
}

function resizeTempleCrop(handle, start, dx, dy) {
  const state = templeCropState;
  const fromLeft = handle.includes("w");
  const fromTop = handle.includes("n");
  const anchorX = fromLeft ? start.cropX + start.cropWidth : start.cropX;
  const anchorY = fromTop ? start.cropY + start.cropHeight : start.cropY;
  let width = Math.max(60, fromLeft ? start.cropWidth - dx : start.cropWidth + dx);
  let height = width / state.ratio;
  if (height > state.displayHeight) {
    height = state.displayHeight;
    width = height * state.ratio;
  }
  let x = fromLeft ? anchorX - width : anchorX;
  let y = fromTop ? anchorY - height : anchorY;
  if (x < 0) {
    x = 0;
    width = anchorX;
    height = width / state.ratio;
    y = fromTop ? anchorY - height : anchorY;
  }
  if (y < 0) {
    y = 0;
    height = anchorY;
    width = height * state.ratio;
    x = fromLeft ? anchorX - width : anchorX;
  }
  if (x + width > state.displayWidth) {
    width = state.displayWidth - x;
    height = width / state.ratio;
  }
  if (y + height > state.displayHeight) {
    height = state.displayHeight - y;
    width = height * state.ratio;
    x = fromLeft ? anchorX - width : anchorX;
  }
  state.x = Math.max(0, x);
  state.y = Math.max(0, y);
  state.width = Math.max(1, width);
  state.height = Math.max(1, height);
}

function updateTempleCropSelection() {
  const state = templeCropState;
  if (!state) return;
  Object.assign(state.selection.style, {
    left: `${state.x}px`,
    top: `${state.y}px`,
    width: `${state.width}px`,
    height: `${state.height}px`,
  });
}

async function applyTempleCrop() {
  const state = templeCropState;
  if (!state) return;
  const button = $("#templeCropOverlay [data-crop-apply]");
  try {
    button.disabled = true;
    button.textContent = "กำลังบันทึก...";
    const scaleX = state.image.naturalWidth / state.displayWidth;
    const scaleY = state.image.naturalHeight / state.displayHeight;
    const outputWidth = Math.min(state.viewport === "mobile" ? 1080 : 1600, Math.round(state.width * scaleX));
    const outputHeight = Math.round(outputWidth / state.ratio);
    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext("2d");
    context.drawImage(
      state.image,
      state.x * scaleX,
      state.y * scaleY,
      state.width * scaleX,
      state.height * scaleY,
      0,
      0,
      outputWidth,
      outputHeight,
    );
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    const url = await uploadAdminMedia(dataUrl, state.fileName || templeImageFilename(state));
    setTempleImage(state.role, state.viewport, url, {
      originalUrl: state.src,
      provider: detectImageProvider(url),
      width: outputWidth,
      height: outputHeight,
    });
    closeTempleCropper();
    setStatus("ครอปและบันทึกรูปแล้ว", "ok");
    renderTemples();
  } catch (error) {
    button.disabled = false;
    button.textContent = "ครอปและบันทึก";
    setStatus(`บันทึกรูปไม่สำเร็จ: ${error.message}`, "error");
  }
}

function closeTempleCropper() {
  $("#templeCropOverlay")?.classList.remove("is-open");
  templeCropState = null;
}

return { imageFieldFromButton, setTempleImage, useTempleImageUrl, verifyImageLoads, cropTempleImage, reuseTempleImage, clearTempleImage, handleTempleImageUpload, templeImageFilename, detectImageProvider, uploadAdminMedia, openTempleCropper, initializeTempleCrop, bindTempleCropPointerEvents, pickCropBox, moveTempleCrop, resizeTempleCrop, updateTempleCropSelection, applyTempleCrop, closeTempleCropper };
}
