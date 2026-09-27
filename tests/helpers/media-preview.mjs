import path from "node:path";
import { createActivitiesPreview } from "./activities-preview.mjs";
import media from "../../api/admin/media.js";

process.env.MONGKOLWELA_MEDIA_DIR = path.join(process.cwd(), ".local/media-preview");
process.env.MONGKOLWELA_ACTIVITIES_DIR = path.join(process.cwd(), ".local/activities-preview");
const server = createActivitiesPreview({ extraHandlers: { "/api/admin/media": media } });
server.listen(4328, "127.0.0.1", () => process.stdout.write("Isolated media preview: http://127.0.0.1:4328/admin/ (local Admin password: admin)\n"));
