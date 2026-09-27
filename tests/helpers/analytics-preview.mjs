import { createActivitiesPreview } from "./activities-preview.mjs";
import analytics from "../../api/admin/analytics.js";

const server = createActivitiesPreview({ extraHandlers: {
  "/api/admin/analytics": (req, res) => {
    if (req.method === "GET") return analytics(req, res);
    res.statusCode = 405; res.end();
  },
} });
server.listen(4329, "127.0.0.1", () => process.stdout.write("Read-only analytics preview: http://127.0.0.1:4329/admin/?section=analytics (local password: admin)\n"));
