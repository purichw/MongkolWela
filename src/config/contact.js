// Build defaults. Published page attribute patches own these values at runtime.
export const contactDefaults = {
  email: "mongkolwela@mongkolwela.com",
  lineId: "@MongkolWela",
};

export function contactChannels({ email = "", lineId = "" } = {}) {
  const address = String(email).trim();
  const handle = String(lineId).trim();
  return {
    email: /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(address) ? address : "",
    lineId: /^@[A-Za-z0-9._-]+$/.test(handle) ? handle : "",
  };
}

export function contactEmailHref(email, subject = "") {
  const address = contactChannels({ email }).email;
  return address ? `mailto:${encodeURIComponent(address).replace(/%40/g, "@")}?subject=${encodeURIComponent(subject)}` : "";
}

export function contactLineHref(lineId) {
  const handle = contactChannels({ lineId }).lineId;
  return handle ? `https://line.me/R/ti/p/${encodeURIComponent(handle)}` : "";
}
