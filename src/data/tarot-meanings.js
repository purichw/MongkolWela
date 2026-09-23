import { managedContent } from "../lib/managed-content.js";
import { majorArcanaDetails } from "./tarot-major-arcana-details.js";

const elementLabels = {
  air: "ลม",
  water: "น้ำ",
  fire: "ไฟ",
  earth: "ดิน",
};

const majorSlugAliases = {
  strength: "the-strength",
  "wheel-of-fortune": "the-wheel-of-fortune",
  justice: "the-justice",
  death: "the-death",
  judgement: "the-judgment",
};

const suitDefinitions = {
  WANDS: {
    slug: "wands",
    label: "ไม้เท้า",
    labelEn: "Wands",
    element: "ไฟ",
    field: "แรงบันดาลใจ งานสร้างสรรค์ เป้าหมาย และการลงมือ",
    western: "สาย Wands ในตะวันตกมักผูกกับธาตุไฟ ความกล้า ความปรารถนา และการผลักสิ่งที่คิดให้เกิดจริง",
  },
  CUPS: {
    slug: "cups",
    label: "ถ้วย",
    labelEn: "Cups",
    element: "น้ำ",
    field: "หัวใจ ความสัมพันธ์ อารมณ์ และการเยียวยา",
    western: "สาย Cups เชื่อมกับธาตุน้ำ ความรู้สึก สัญชาตญาณ ความรัก และโลกภายใน",
  },
  SWORDS: {
    slug: "swords",
    label: "ดาบ",
    labelEn: "Swords",
    element: "ลม",
    field: "ความคิด คำพูด การตัดสินใจ และความจริง",
    western: "สาย Swords ผูกกับธาตุลม ปัญญา การสื่อสาร ความขัดแย้ง และการตัดผ่านความสับสน",
  },
  PENTACLES: {
    slug: "pentacles",
    label: "เหรียญ",
    labelEn: "Pentacles",
    element: "ดิน",
    field: "เงิน งาน ทรัพย์สิน สุขภาพ และความมั่นคง",
    western: "สาย Pentacles เชื่อมกับธาตุดิน เรื่องจับต้องได้ การทำงาน ทรัพยากร และผลลัพธ์ที่ต้องค่อย ๆ สร้าง",
  },
};

const rankDefinitions = [
  ["ACE", "เอซ", "เมล็ดแรก", "โอกาสใหม่ในเรื่อง{field} เพิ่งเปิดขึ้น ยังเล็กแต่มีพลังตั้งต้นสูง", "ใช้เป็นสัญญาณเริ่มต้น ลงมือวางรากฐานให้ชัดตั้งแต่ก้าวแรก", "อย่าเร่งผลหรือกระจายพลังจนโอกาสใหม่ไม่ทันเติบโต"],
  ["TWO", "สอง", "การเลือกและการประสาน", "เรื่อง{field}ต้องอาศัยการชั่งใจ การจับคู่ หรือการมองสองฝั่งให้สมดุล", "ถามใจให้ชัดว่าทางไหนสงบกว่า แล้วค่อยเลือกอย่างมีสติ", "ระวังลังเลนานเกินไปหรือพยายามรักษาทุกทางไว้พร้อมกัน"],
  ["THREE", "สาม", "การเติบโตและความร่วมมือ", "เรื่อง{field}เริ่มเห็นเค้าโครงของผล การร่วมมือและการต่อยอดจะช่วยเปิดทาง", "ใช้คนให้ถูกบทบาท มองไกลกว่าผลเฉพาะหน้า", "อย่าคาดหวังให้ทุกอย่างเติบโตทันใจ"],
  ["FOUR", "สี่", "ฐานมั่นคง", "พลังของการจัดระเบียบ สร้างบ้าน สร้างระบบ หรือรักษาความมั่นคงในเรื่อง{field}", "ทำสิ่งเดิมให้แน่นก่อนเพิ่มสิ่งใหม่", "ระวังยึดติดกับความปลอดภัยจนไม่กล้าขยับ"],
  ["FIVES", "ห้า", "แรงเสียดทาน", "อาจมีบททดสอบ ความขัดแย้ง หรือความไม่สบายใจในเรื่อง{field}", "เลือกสู้เฉพาะเรื่องที่ควรสู้ และรักษาพลังไว้กับสิ่งสำคัญ", "ระวังคำพูดแรง การแข่งขันเกินพอดี หรือการเสียศูนย์เพราะอัตตา"],
  ["SIXS", "หก", "ฟื้นสมดุล", "มีโอกาสรับความช่วยเหลือ ปรับความเข้าใจ หรือเห็นทางออกที่นุ่มนวลขึ้นในเรื่อง{field}", "ยื่นมือหรือรับมือผู้อื่นอย่างสง่างาม", "อย่าติดค้างบุญคุณหรืออดีตจนไม่เป็นอิสระ"],
  ["SEVENS", "เจ็ด", "ความเพียรและการทดสอบใจ", "เรื่อง{field}ต้องใช้สติ ความอดทน และการยืนหยัดในสิ่งที่เชื่อ", "รักษาระยะ ยืนยันเป้าหมาย และดูแลพลังใจ", "ระวังป้องกันตัวมากเกินไปจนไม่ฟังใคร"],
  ["EIGHTS", "แปด", "การเคลื่อนไหวและฝึกฝน", "เรื่อง{field}กำลังเคลื่อนเร็ว หรือจำเป็นต้องทำซ้ำให้ชำนาญ", "เลือกหนึ่งสิ่งสำคัญแล้วทำให้คืบหน้าอย่างจริงจัง", "ระวังรีบจนหลุดรายละเอียด หรือทำไปโดยใจไม่อยู่กับงาน"],
  ["NINES", "เก้า", "ผลลัพธ์และการทบทวน", "เรื่อง{field}ใกล้ให้ผล คุณจะเห็นทั้งสิ่งที่ได้มาและสิ่งที่ยังค้างในใจ", "รับความสำเร็จอย่างรู้คุณ แล้วทบทวนว่าควรดูแลอะไรต่อ", "อย่าโดดเดี่ยวตัวเองหรือคิดว่าต้องแบกทุกอย่างคนเดียว"],
  ["TENS", "สิบ", "ครบรอบและภาระ", "เรื่อง{field}มาถึงจุดหนักหรือจุดครบวาระ ต้องจัดการให้จบอย่างมีสติ", "แยกภาระที่ต้องถือเองออกจากสิ่งที่ควรแบ่งหรือวางลง", "ระวังแบกเกินกำลังเพราะไม่กล้าปฏิเสธ"],
  ["PAGES", "มหาดเล็ก", "ข่าวสารและการเรียนรู้", "มีข่าว ข้อความ หรือบทเรียนใหม่เกี่ยวกับ{field} เหมาะกับการเริ่มศึกษาอย่างถ่อมตน", "ถามคำถามดี ๆ และเปิดใจเรียนรู้จากผู้มีประสบการณ์", "อย่าด่วนประกาศสิ่งที่ยังรู้ไม่ครบ"],
  ["KNIGHTS", "อัศวิน", "การเดินหน้า", "พลังของเรื่อง{field}กำลังเคลื่อน ต้องใช้ความกล้า ทิศทาง และวินัย", "เลือกทิศทางก่อนเพิ่มความเร็ว", "ระวังใจร้อนหรือไล่ตามเป้าหมายจนลืมคนรอบตัว"],
  ["QUEENS", "ราชินี", "การดูแลอย่างลึกซึ้ง", "เรื่อง{field}ต้องใช้ความเข้าใจ การประคอง และสัญชาตญาณละเอียดอ่อน", "ดูแลแก่นของเรื่อง ไม่ใช่แค่ภาพภายนอก", "ระวังเก็บทุกอย่างมาเป็นภาระใจของตัวเอง"],
  ["KINGS", "ราชา", "ความเชี่ยวชาญและอำนาจ", "ถึงเวลารับผิดชอบ ใช้วุฒิภาวะ และเป็นหลักในเรื่อง{field}", "ตัดสินใจอย่างมืออาชีพและเป็นที่พึ่งเท่าที่สมควร", "อย่าควบคุมทุกอย่างจนคนอื่นไม่มีพื้นที่หายใจ"],
];

const displayRanks = {
  FIVES: "FIVE",
  SIXS: "SIX",
  SEVENS: "SEVEN",
  EIGHTS: "EIGHT",
  NINES: "NINE",
  TENS: "TEN",
  PAGES: "PAGE",
  KNIGHTS: "KNIGHT",
  QUEENS: "QUEEN",
  KINGS: "KING",
};

function slugify(value) {
  return value.toLowerCase().replaceAll(" ", "-");
}

function cardImage(id) {
  return `/assets/images/tarot/rws-jpg/${id}.jpg`;
}

function cardThumbImage(id) {
  return `/assets/images/tarot/rws-thumb/${id}.jpg`;
}

function createMajorCards() {
  return majorArcanaDetails.map((detail) => {
    const id = detail.slug || detail.id;
    const element = elementLabels[detail.element] || detail.element;
    const number = detail.number || detail.numerology;
    const workMoney = [
      detail.upright?.career ? `การงาน: ${detail.upright.career}` : "",
      detail.upright?.finance ? `การเงิน: ${detail.upright.finance}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    return {
      id,
      slug: id,
      name: detail.name,
      thName: detail.name_th,
      group: "major",
      groupLabel: "Major Arcana",
      order: detail.index,
      image: cardImage(id),
      thumbImage: cardThumbImage(id),
      theme: detail.keywords_upright?.[0] || detail.name_th,
      overview: detail.overview,
      upright: detail.upright?.general || detail.overview,
      reversed: detail.reversed?.general || "",
      love: detail.upright?.love || "",
      workMoney,
      health: detail.upright?.health || "",
      western: `ในสาย Western ไพ่ใบนี้สัมพันธ์กับ ${detail.astrology || detail.ruling_planet || "archetype หลัก"}${
        element ? ` ธาตุ${element}` : ""
      } และเลข ${number} ใช้อ่านเป็น archetype หรือบทเรียนหลักของชีวิต`,
      keywords: [
        ...(detail.keywords_upright || []).slice(0, 5),
        detail.astrology || "",
        number ? `เลข ${number}` : "",
      ].filter(Boolean),
      keywordsUpright: detail.keywords_upright || [],
      keywordsReversed: detail.keywords_reversed || [],
      symbolism: detail.symbolism || [],
      uprightDetails: detail.upright || {},
      reversedDetails: detail.reversed || {},
      relatedCards: (detail.related_cards || []).map((relatedCard) => ({
        ...relatedCard,
        card_id: majorSlugAliases[relatedCard.card_id] || relatedCard.card_id,
      })),
      reflectionQuestions: detail.reflection_questions || [],
      closingSummary: detail.closing_summary || "",
      element,
      astrology: detail.astrology || "",
      rulingPlanet: detail.ruling_planet || "",
      numerology: detail.numerology,
      number,
    };
  });
}

function createMinorCards() {
  return Object.entries(suitDefinitions).flatMap(([suit, suitInfo], suitIndex) =>
    rankDefinitions.map(([rank, thRank, theme, overview, uprightAdvice, caution], rankIndex) => {
      const assetName = `THE ${rank} OF ${suit}`;
      const id = slugify(assetName);
      const displayRank = displayRanks[rank] || rank;
      const name = `THE ${displayRank} OF ${suit}`;
      const thName = `${suitInfo.label} ${thRank}`;
      const overviewText = overview.replace("{field}", suitInfo.field);

      return {
        id,
        slug: id,
        name,
        thName,
        group: suitInfo.slug,
        groupLabel: `${suitInfo.label} (${suitInfo.labelEn})`,
        order: 22 + suitIndex * rankDefinitions.length + rankIndex,
        image: cardImage(id),
        thumbImage: cardThumbImage(id),
        suit,
        rank,
        element: suitInfo.element,
        theme,
        overview: overviewText,
        upright: `${overviewText} อ่านแบบไทยคือให้ดูสถานการณ์จริงตรงหน้าและถามว่าเราควรประคองพลังของ${suitInfo.label}อย่างไรให้พอดี`,
        reversed: `เมื่อกลับหัว ความหมายมักชี้ว่าพลังของ${suitInfo.label}เสียสมดุล อาจมากเกินไป น้อยเกินไป หรือใช้ผิดจังหวะ`,
        love: `ด้านความรัก ไพ่ใบนี้สะท้อน${suitInfo.field}ในความสัมพันธ์ ให้ระวังการตอบสนองจากอารมณ์ชั่ววูบและกลับมาฟังใจจริง`,
        workMoney: `ด้านงานและเงิน ให้ใช้ไพ่ใบนี้เป็นสัญญาณเรื่อง${suitInfo.field} ${uprightAdvice}`,
        western: `${suitInfo.western} ลำดับ ${thRank} สื่อถึง "${theme}" จึงอ่านร่วมกับตัวเลขและธาตุ ${suitInfo.element} ได้`,
        keywords: [theme, suitInfo.element, suitInfo.label],
        health: "",
        keywordsReversed: [],
        symbolism: [],
        relatedCards: [],
        reflectionQuestions: [],
        closingSummary: "",
        advice: uprightAdvice,
        caution,
      };
    }),
  );
}

export const tarotMeaningGroups = [
  {
    id: "major",
    title: "Major Arcana",
    thTitle: "ไพ่ชุดใหญ่ 22 ใบ",
    copy: "อ่านเป็นบทเรียนหลักของชีวิต จังหวะเปลี่ยนผ่าน การตัดสินใจ และพลังลึกที่กำลังทำงานอยู่",
  },
  {
    id: "wands",
    title: "Wands",
    thTitle: "ไม้เท้า",
    copy: "พลังไฟของความกล้า แรงบันดาลใจ งานสร้างสรรค์ และการผลักเป้าหมายให้เกิดจริง",
  },
  {
    id: "cups",
    title: "Cups",
    thTitle: "ถ้วย",
    copy: "พลังน้ำของหัวใจ ความรัก ความสัมพันธ์ ความรู้สึก และการเยียวยาภายใน",
  },
  {
    id: "swords",
    title: "Swords",
    thTitle: "ดาบ",
    copy: "พลังลมของความคิด คำพูด ความจริง การตัดสินใจ และบททดสอบทางใจ",
  },
  {
    id: "pentacles",
    title: "Pentacles",
    thTitle: "เหรียญ",
    copy: "พลังดินของเงิน งาน ทรัพย์สิน สุขภาพ ความมั่นคง และผลลัพธ์ที่จับต้องได้",
  },
];

export const tarotMeaningCards = managedContent("tarot.tarotMeaningCards", [...createMajorCards(), ...createMinorCards()], {"title":"สารานุกรมไพ่ 78 ใบ","group":"ไพ่ยิปซี","routes":["/tarot/meanings/"]});

export function getTarotMeaningCard(slug) {
  return tarotMeaningCards.find((card) => card.slug === slug);
}

export function getTarotMeaningGroupCards(groupId) {
  return tarotMeaningCards.filter((card) => card.group === groupId);
}
