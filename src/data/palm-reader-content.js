import { managedContent } from "../lib/managed-content.js";
export const LINE_TYPES = managedContent("palmistry.LINE_TYPES", [
  {
    id: 'life_line', nameTh: 'เส้นชีวิต', group: 'main',
    variants: [
      { id: 'long_clear',    nameTh: 'ยาวชัดเจน' },
      { id: 'short',         nameTh: 'สั้น' },
      { id: 'broken',        nameTh: 'ขาดตอน' },
      { id: 'chained',       nameTh: 'เป็นลูกโซ่' },
      { id: 'double_mars',   nameTh: 'คู่ขนาน (Line of Mars)' },
      { id: 'branch_up',     nameTh: 'มีกิ่งขึ้น' },
      { id: 'branch_down',   nameTh: 'มีกิ่งลง' },
      { id: 'wide_arc',      nameTh: 'โค้งกว้าง' },
      { id: 'curves_to_moon',nameTh: 'โค้งไปเนินจันทร์' },
    ]
  },
  {
    id: 'head_line', nameTh: 'เส้นสมอง', group: 'main',
    variants: [
      { id: 'straight_long', nameTh: 'ตรงยาว' },
      { id: 'slight_curve',  nameTh: 'โค้งเล็กน้อย' },
      { id: 'deep_curve',    nameTh: 'โค้งลึก' },
      { id: 'short',         nameTh: 'สั้น' },
      { id: 'double',        nameTh: 'คู่ขนาน' },
      { id: 'forked',        nameTh: 'ปลายแยก' },
      { id: 'broken',        nameTh: 'ขาดตอน' },
    ]
  },
  {
    id: 'heart_line', nameTh: 'เส้นหัวใจ', group: 'main',
    variants: [
      { id: 'long_curved',   nameTh: 'ยาวโค้ง' },
      { id: 'long_straight', nameTh: 'ยาวตรง' },
      { id: 'short',         nameTh: 'สั้น' },
      { id: 'wavy',          nameTh: 'เป็นคลื่น' },
      { id: 'broken',        nameTh: 'ขาดตอน' },
      { id: 'curves_up',     nameTh: 'ปลายโค้งขึ้น' },
      { id: 'points_jupiter',nameTh: 'ปลายชี้เนินพฤหัส' },
    ]
  },
  {
    id: 'fate_line', nameTh: 'เส้นวาสนา', group: 'minor',
    variants: [
      { id: 'clear_from_wrist', nameTh: 'ชัดจากข้อมือ' },
      { id: 'from_life_line',   nameTh: 'เริ่มจากเส้นชีวิต' },
      { id: 'from_moon_mount',  nameTh: 'เริ่มจากเนินจันทร์' },
      { id: 'broken',           nameTh: 'ขาดๆ หายๆ' },
      { id: 'absent',           nameTh: 'ไม่มีเส้น' },
      { id: 'branch_jupiter',   nameTh: 'กิ่งขึ้นพฤหัส' },
      { id: 'from_head_line',   nameTh: 'เริ่มจากเส้นสมอง' },
      { id: 'stops_at_heart',   nameTh: 'หยุดที่เส้นหัวใจ' },
      { id: 'stops_at_head',    nameTh: 'หยุดที่เส้นสมอง' },
      { id: 'branch_sun',       nameTh: 'กิ่งขึ้นเนินอาทิตย์' },
    ]
  },
  {
    id: 'sun_line', nameTh: 'เส้นอาทิตย์', group: 'minor',
    variants: [
      { id: 'clear_present', nameTh: 'มีเส้นชัดเจน' },
      { id: 'short',         nameTh: 'มีแต่เส้นสั้น' },
      { id: 'absent',        nameTh: 'ไม่มีเส้น' },
    ]
  },
  {
    id: 'mercury_line', nameTh: 'เส้นพุธ', group: 'minor',
    variants: [
      { id: 'absent', nameTh: 'ไม่มีเส้น' },
      { id: 'clear_straight', nameTh: 'มีเส้นตรงชัด' },
      { id: 'wavy',   nameTh: 'เป็นคลื่น' },
    ]
  },
  {
    id: 'marriage_line', nameTh: 'เส้นสมรส', group: 'minor',
    variants: [
      { id: 'one_clear',     nameTh: '1 เส้นชัดเจน' },
      { id: 'two_separate',  nameTh: '2 เส้นห่างกัน' },
      { id: 'two_close',     nameTh: '2 เส้นชิดกัน' },
      { id: 'curves_down',   nameTh: 'โค้งลง' },
      { id: 'crosses_heart', nameTh: 'ตัดผ่านเส้นหัวใจ' },
      { id: 'curves_up',     nameTh: 'โค้งขึ้น' },
    ]
  },
], {"title":"เส้นและลักษณะมือ","group":"ลายมือ","routes":["/horoscope/palmistry/"]});

// Image filenames (from /public/images/lines/index.json)
export const IMG_INDEX = {
  life_line:     { long_clear:'life_line_long_clear.png', short:'life_line_short.png', broken:'life_line_broken.png', chained:'life_line_chained.png', double_mars:'life_line_double_mars.png', branch_up:'life_line_branch_up.png', branch_down:'life_line_branch_down.png', wide_arc:'life_line_wide_arc.png', curves_to_moon:'life_line_curves_to_moon.png' },
  head_line:     { straight_long:'head_line_straight_long.png', slight_curve:'head_line_slight_curve.png', deep_curve:'head_line_deep_curve.png', short:'head_line_short.png', double:'head_line_double.png', forked:'head_line_forked.png', broken:'head_line_broken.png' },
  heart_line:    { long_curved:'heart_line_long_curved.png', long_straight:'heart_line_long_straight.png', short:'heart_line_short.png', wavy:'heart_line_wavy.png', broken:'heart_line_broken.png', curves_up:'heart_line_curves_up.png', points_jupiter:'heart_line_points_jupiter.png' },
  fate_line:     { clear_from_wrist:'fate_line_clear_from_wrist.png', from_life_line:'fate_line_from_life_line.png', from_moon_mount:'fate_line_from_moon_mount.png', broken:'fate_line_broken.png', absent:'fate_line_absent.png', branch_jupiter:'fate_line_branch_jupiter.png', from_head_line:'fate_line_from_head_line.png', stops_at_heart:'fate_line_stops_at_heart.png', stops_at_head:'fate_line_stops_at_head.png', branch_sun:'fate_line_branch_sun.png' },
  sun_line:      { clear_present:'sun_line_clear_present.png', short:'sun_line_short.png', absent:'sun_line_absent.png' },
  mercury_line:  { absent:'mercury_line_absent.png', clear_straight:'mercury_line_clear_straight.png', wavy:'mercury_line_wavy.png' },
  marriage_line: { one_clear:'marriage_line_one_clear.png', two_separate:'marriage_line_two_separate.png', two_close:'marriage_line_two_close.png', curves_down:'marriage_line_curves_down.png', crosses_heart:'marriage_line_crosses_heart.png', curves_up:'marriage_line_curves_up.png' },
};

// Readings data — keyed by [line_type][variant_id][category_id]
export const READINGS = managedContent("palmistry.READINGS", {
  life_line: {
    long_clear:     { health: { text: 'ตามตำรามักอ่านว่ามีฐานพลังและจังหวะชีวิตที่ต่อเนื่อง ไม่ได้ใช้ยืนยันอายุขัยหรือภาวะสุขภาพจริง', level: 'good' } },
    short:          { health: { text: 'เส้นชีวิตสั้นไม่เท่ากับอายุสั้น ควรอ่านร่วมกับความชัด ความต่อเนื่อง และเส้นอื่นมากกว่าตัดสินจากความยาวเพียงอย่างเดียว', level: 'neutral' } },
    broken:         { health: { text: 'ตำรามักอ่านเป็นช่วงเปลี่ยนผ่านหรือจังหวะที่พลังชีวิตไม่ต่อเนื่อง ไม่ควรโยงตรงกับโรค อุบัติเหตุ หรืออายุขัย', level: 'warning' } },
    chained:        { health: { text: 'มักอ่านว่าเป็นช่วงที่พลังหรือความมั่นคงแกว่ง ควรใช้เป็นข้อเตือนให้ดูแลสมดุลชีวิต ไม่ใช่ข้อสรุปทางการแพทย์', level: 'warning' } },
    double_mars:    { health: { text: 'ตำราเรียกว่าเส้นช่วยชีวิตหรือ Line of Mars มักตีความเป็นแรงพยุงและความสามารถในการฟื้นตัวเชิงสัญลักษณ์', level: 'good' } },
    branch_up:      {
      health: { text: 'มักอ่านเป็นจังหวะที่แรงขับและความมั่นใจเพิ่มขึ้นหลังผ่านช่วงติดขัด', level: 'good' },
      fate:   { text: 'มักอ่านเป็นแรงส่งหรือโอกาสใหม่ที่พาให้เจ้าชะตาขยับทิศทางชีวิตขึ้น แต่ควรดูความชัดของเส้นหลักร่วมด้วย', level: 'good' },
    },
    branch_down:    {
      career:      { text: 'การงานอาจชะลอหรือถดถอยในช่วงนั้น ควรประคองกำลังและไม่รับภาระเกินตัว', level: 'warning' },
      health:      { text: 'มักอ่านเป็นช่วงที่กำลังหรือแรงขับลดลง ควรจัดสมดุลการพักและภาระให้เหมาะสม', level: 'warning' },
      personality: { text: 'อาจรู้สึกอ่อนล้าหรือหมดแรงง่ายกว่าปกติ แต่เป็นลักษณะที่อ่านตามช่วงของเส้น', level: 'neutral' },
    },
    wide_arc:      {
      love:        { text: 'มีเสน่ห์และพลังดึงดูดสูง เปิดรับความสัมพันธ์และประสบการณ์ใหม่ได้ดี', level: 'good' },
      career:      { text: 'มีแรงทำงานต่อเนื่อง เหมาะกับงานที่ต้องใช้พลังและความอึด', level: 'good' },
      health:      { text: 'ตามตำรามักโยงกับพลังชีวิตที่เปิดกว้างและความกระตือรือร้น ไม่ใช่การประเมินสุขภาพร่างกาย', level: 'good' },
      personality: { text: 'บุคลิกกระตือรือร้น ชอบออกไปพบโลกกว้าง และมีความน่าสนใจในตัวเอง', level: 'good' },
    },
    curves_to_moon: {
      health: { text: 'มักอ่านว่าจังหวะชีวิตสัมพันธ์กับการเดินทาง การเปลี่ยนที่อยู่ หรือสภาพแวดล้อมใหม่', level: 'neutral' },
      fate:   { text: 'ชะตาพาไปพบสิ่งใหม่ในที่ไกลๆ ชีวิตจะโลดแล่นและหลากหลาย', level: 'neutral' },
    },
  },
  head_line: {
    straight_long:  {
      career:      { text: 'เหมาะงานที่ต้องความแม่นยำ วิทยาศาสตร์ วิศวกรรม การเงิน', level: 'good' },
      personality: { text: 'นักปฏิบัติ มีระบบ คิดรอบคอบ ตัดสินใจบนข้อมูล', level: 'good' },
    },
    slight_curve:   {
      career:      { text: 'เหมาะงานสร้างสรรค์ ศิลปะ การเขียน ออกแบบ', level: 'good' },
      personality: { text: 'สร้างสรรค์ จินตนาการดี ชอบศิลปะ มีความคิดนอกกรอบ', level: 'good' },
    },
    deep_curve:     {
      career:      { text: 'นักฝัน มีจินตนาการสูง เหมาะงานสร้างสรรค์ นักเขียน นักดนตรี', level: 'good' },
      personality: { text: 'ลึกซึ้ง ชอบจินตนาการ บางครั้งอยู่ในโลกของตัวเอง มีความไวทางอารมณ์', level: 'neutral' },
    },
    short:          {
      career:      { text: 'ตัดสินใจเร็ว เน้นผลลัพธ์จริงจัง ไม่ชอบทฤษฎียาวๆ', level: 'neutral' },
      personality: { text: 'ตรงไปตรงมา มีสัญชาตญาณดี เชื่อใจตัวเองสูง ไม่ชอบอ้อมค้อม', level: 'neutral' },
    },
    double:         {
      career:      { text: 'สามารถทำงานหลายอย่างพร้อมกัน มีความสามารถหลายด้าน', level: 'good' },
      personality: { text: 'มีบุคลิกหลายด้าน เข้าใจมุมมองของคนต่างกัน บางครั้งรู้สึกแตกออกเป็นสองด้าน', level: 'good' },
    },
    forked:         {
      career:      { text: 'ยืดหยุ่นสูง ทำงานทั้งฝั่งวิชาการและสร้างสรรค์ได้ดี', level: 'good' },
      personality: { text: 'สมดุลระหว่างตรรกะและความคิดสร้างสรรค์ เป็นนักสื่อสารที่ดี', level: 'good' },
    },
    broken:         {
      career:      { text: 'ความคิดขาดความต่อเนื่อง ระวังการตัดสินใจผิดพลาดในช่วงสำคัญ', level: 'warning' },
      personality: { text: 'ความคิดเปลี่ยนแปลงบ่อย บางครั้งขาดสมาธิและความมั่นใจ', level: 'warning' },
    },
  },
  heart_line: {
    long_curved:   { love: { text: 'มักอ่านว่าเจ้าชะตาให้พื้นที่กับความรู้สึกและแสดงความรักค่อนข้างชัด แต่ยังควรดูความลึกและความต่อเนื่องของเส้นร่วมด้วย', level: 'good' } },
    long_straight: { love: { text: 'มักอ่านว่าเรื่องใจผ่านเหตุผลและความรับผิดชอบมากกว่าอารมณ์ฉับพลัน อาจรักมั่นคงแต่แสดงออกแบบสงบ', level: 'good' } },
    short:         { love: { text: 'มักอ่านว่าเลือกเปิดใจอย่างระวังหรือให้ความรักแบบเฉพาะเจาะจง ไม่ได้แปลว่ารักใครไม่ได้หรือชีวิตรักต้องสั้น', level: 'neutral' } },
    wavy:          { love: { text: 'มักอ่านว่าอารมณ์สัมพันธ์มีหลายจังหวะ ควรสังเกตความชัดของความต้องการและขอบเขตในความสัมพันธ์', level: 'warning' } },
    broken:        { love: { text: 'มักอ่านเป็นช่วงสะดุดหรือประสบการณ์ที่ทำให้เรื่องใจต้องทบทวน ไม่ควรฟันธงว่าเป็นแผลรักถาวร', level: 'warning' } },
    curves_up:     { love: { text: 'มักอ่านว่าเจ้าชะตามีแนวโน้มสื่อสารความรู้สึกตรงขึ้นและพาความสัมพันธ์ไปในทางสร้างสรรค์เมื่อบริบทอื่นสนับสนุน', level: 'good' } },
    points_jupiter: {
      love:        { text: 'มีมาตรฐานและอุดมคติสูงในความรัก ต้องการความสัมพันธ์ที่มีคุณค่าและชัดเจน', level: 'neutral' },
      career:      { text: 'มุ่งหวังตำแหน่งหรือบทบาทที่สูงขึ้น และจริงจังกับความสำเร็จ', level: 'good' },
      fate:        { text: 'แนวทางชีวิตสัมพันธ์กับความทะเยอทะยานและอุดมการณ์ที่ตั้งไว้', level: 'good' },
      personality: { text: 'มีอุดมการณ์ เชื่อมั่นในหลักของตน และคาดหวังกับตัวเองสูง', level: 'neutral' },
    },
  },
  fate_line: {
    clear_from_wrist: {
      career: { text: 'มักอ่านว่าเจ้าชะตามีแกนงานหรือทิศทางชีวิตที่จับต้องได้ตั้งแต่ช่วงต้น แต่ความดีร้ายต้องดูความลึก ความแตก และเส้นอาทิตย์ประกอบ', level: 'good' },
      fate:   { text: 'เส้นที่ขึ้นจากฐานมือชัดมักบอกแรงของหน้าที่ เป้าหมาย หรือโครงชีวิตที่ต่อเนื่อง ไม่ควรอ่านเป็นโชคดีตลอดชีวิตแบบตายตัว', level: 'good' },
    },
    from_life_line: {
      career: { text: 'Self-made person ทุกอย่างได้มาด้วยความพยายามของตัวเอง ไม่ใช่โชค', level: 'good' },
      fate:   { text: 'สร้างชะตาตัวเอง ชีวิตขึ้นกับความพยายาม ไม่ต้องพึ่งดวง', level: 'neutral' },
    },
    from_moon_mount: {
      career: { text: 'อาชีพที่เกี่ยวกับสาธารณชน ศิลปะ การท่องเที่ยว หรือได้รับการสนับสนุนจากผู้อื่น', level: 'good' },
      fate:   { text: 'ชะตาได้รับแรงสนับสนุนจากคนรอบข้าง ประชาชน หรือการเดินทาง', level: 'good' },
    },
    broken: {
      career: { text: 'มักอ่านว่าเส้นทางงานหรือเป้าหมายมีช่วงเปลี่ยนบท ไม่จำเป็นต้องแปลว่าเสียหายถาวร ควรดูว่าเส้นช่วงใหม่ชัดขึ้นหรืออ่อนลง', level: 'warning' },
      fate:   { text: 'ลักษณะนี้เหมาะอ่านเป็นจังหวะเปลี่ยนแปลงหลายบทของชีวิต มากกว่าคำตัดสินว่าดีหรือร้ายเสมอไป', level: 'neutral' },
    },
    absent: {
      career: { text: 'การไม่เห็นเส้นวาสนาชัดไม่ใช่สัญญาณว่าไม่มีทางสำเร็จ มักอ่านว่าเส้นทางงานยืดหยุ่นและไม่ยึดกับแกนเดียวตลอด', level: 'neutral' },
      fate:   { text: 'บางตำรามองว่าเจ้าชะตาเลือกทางเองมากกว่าเดินตามแรงภายนอก จึงควรอ่านร่วมกับเส้นสมอง เส้นชีวิต และบริบทจริง', level: 'neutral' },
    },
    branch_jupiter: {
      career: { text: 'มีโอกาสก้าวหน้าในสายอาชีพ ชื่อเสียงและตำแหน่งสูงขึ้น อาชีพที่มีอำนาจ', level: 'good' },
      fate:   { text: 'โชคชะตาเปิดกว้าง มีการพัฒนาตัวเองอย่างต่อเนื่อง เข้าถึงตำแหน่งสูง', level: 'good' },
    },
    from_head_line: {
      career:      { text: 'ความสำเร็จมาอย่างค่อยเป็นค่อยไปจากความคิด ความรู้ และประสบการณ์ มักเด่นชัดขึ้นในช่วงหลังของชีวิต', level: 'good' },
      fate:        { text: 'ชะตาเปิดจากการตัดสินใจและปัญญามากกว่าโชคที่ได้มาโดยง่าย', level: 'neutral' },
      personality: { text: 'พึ่งการวางแผนและเหตุผลสูง เชื่อในการสร้างทางเดินของตัวเอง', level: 'good' },
    },
    stops_at_heart: {
      career: { text: 'ตำราเดิมมักอ่านว่าความสัมพันธ์หรือเรื่องใจอาจมีผลต่อทิศทางงาน จึงควรดูบริบทจริงก่อนสรุปว่าเป็นอุปสรรค', level: 'warning' },
      fate:   { text: 'เส้นที่หยุดแถวเส้นหัวใจเหมาะอ่านเป็นจุดเปลี่ยนที่เกี่ยวกับความรู้สึก คุณค่า หรือความสัมพันธ์ มากกว่าคำตัดสินเรื่องชะตา', level: 'neutral' },
    },
    stops_at_head: {
      career:      { text: 'ตำราเดิมมักโยงกับจุดเปลี่ยนจากการตัดสินใจหรือวิธีคิด ควรใช้เป็นสัญญาณให้ทบทวนข้อมูลก่อนเลือกทางสำคัญ', level: 'warning' },
      personality: { text: 'เหมาะอ่านเป็นช่วงที่ต้องปรับกรอบคิดหรือวิธีตัดสินใจ ไม่ใช่คำตัดสินว่าความคิดผิดพลาดเสมอไป', level: 'neutral' },
    },
    branch_sun: {
      career: { text: 'มีโอกาสประสบความสำเร็จพร้อมชื่อเสียงหรือการยอมรับในผลงาน', level: 'good' },
      fate:   { text: 'จังหวะชะตาหนุนทั้งความสำเร็จ โชคลาภ และการเป็นที่รู้จัก', level: 'good' },
    },
  },
  sun_line: {
    clear_present: {
      career: { text: 'มักอ่านว่าเจ้าชะตามีช่องทางให้ผลงาน การยอมรับ หรือชื่อเสียงปรากฏชัดขึ้นเมื่อประกอบกับเส้นหลักที่มั่นคง', level: 'good' },
      fate:   { text: 'เส้นอาทิตย์ที่ชัดมักใช้ประกอบเรื่องความสว่าง ความพึงพอใจ และการเห็นคุณค่าของผลงาน ไม่ใช่หลักประกันความสำเร็จทุกด้าน', level: 'good' },
    },
    short: {
      career: { text: 'มีศักยภาพด้านชื่อเสียงหรือผลงานเด่น แต่ยังต้องใช้เวลาและความต่อเนื่องจึงจะเปิดออกเต็มที่', level: 'neutral' },
    },
    absent: {
      career: { text: 'การไม่เห็นเส้นอาทิตย์ชัดอาจหมายถึงการยอมรับยังไม่ใช่แกนหลักของช่วงนี้ ควรดูเส้นวาสนาและบริบทงานร่วมด้วย', level: 'neutral' },
      fate:   { text: 'ไม่ควรอ่านว่าไร้ความสุขหรือไร้ชื่อเสียงเสมอไป เพียงบอกว่าเครื่องหมายด้านการยอมรับยังไม่เด่นพอให้ฟันธง', level: 'neutral' },
    },
  },
  mercury_line: {
    absent: { health: { text: 'ตำราบางสายถือว่าการไม่มีเส้นพุธเด่นไม่ใช่สัญญาณเสีย แต่ไม่สามารถใช้ยืนยันสุขภาพจริงได้', level: 'neutral' } },
    clear_straight: {
      career: { text: 'ทำงานได้มีประสิทธิภาพ โดยเฉพาะงานที่ใช้การสื่อสาร การค้า หรือการจัดระบบ', level: 'good' },
      health: { text: 'ในเชิงสัญลักษณ์มักอ่านว่าเจ้าชะตาจัดระบบชีวิตและสื่อสารความต้องการของตนได้ค่อนข้างชัด', level: 'neutral' },
    },
    wavy:   { health: { text: 'ตำราเดิมมักให้ระวังความไม่เป็นระบบและความเครียดสะสม แต่ไม่ควรใช้วินิจฉัยอวัยวะหรือโรคเฉพาะ', level: 'warning' } },
  },
  marriage_line: {
    one_clear:    { love: { text: 'ตำรามักอ่านว่าเจ้าชะตาให้ความสำคัญกับความสัมพันธ์หลักที่ชัดเจนและมีแนวโน้มรักษาความผูกพันระยะยาว', level: 'good' } },
    two_separate: { love: { text: 'มักอ่านว่ามีความสัมพันธ์สำคัญมากกว่าหนึ่งช่วงหรือหนึ่งบท แต่ไม่ควรฟันธงจำนวนคู่หรือผลลัพธ์ของแต่ละความสัมพันธ์', level: 'neutral' } },
    two_close:    { love: { text: 'มักอ่านว่ามีความรู้สึกหรือความสัมพันธ์สองชั้นที่อยู่ใกล้กัน ควรระวังความลังเลและสื่อสารขอบเขตให้ชัด โดยไม่ฟันธงเรื่องบุคคลที่สาม', level: 'warning' } },
    curves_down:  { love: { text: 'มักอ่านว่าความสัมพันธ์มีแรงกดหรือภาระทางใจ ควรพิจารณาร่วมกับเส้นหัวใจและสถานการณ์จริงโดยไม่ฟันธงเรื่องการสูญเสีย', level: 'warning' } },
    crosses_heart:{ love: { text: 'ตำราเดิมมองว่าเป็นความสัมพันธ์ที่กระทบใจมาก ควรอ่านร่วมกับเส้นหัวใจและมือทั้งสองข้าง ไม่ใช้ทำนายการสูญเสียแบบตายตัว', level: 'warning' } },
    curves_up:    { love: { text: 'มักอ่านว่าแนวโน้มของความสัมพันธ์พาไปทางเติบโตหรือคลี่คลายดีขึ้น แต่ยังต้องดูความชัดของเส้นและมือทั้งสองข้างประกอบ', level: 'good' } },
  },
}, {"title":"คำอ่านลายมือ","group":"ลายมือ","routes":["/horoscope/palmistry/"]});

// Category definitions
export const CATEGORIES = managedContent("palmistry.CATEGORIES", [
  { id: 'love',        nameTh: 'ความรัก' },
  { id: 'career',      nameTh: 'การงาน' },
  { id: 'health',      nameTh: 'สุขภาพ' },
  { id: 'fate',        nameTh: 'โชคชะตา' },
  { id: 'personality', nameTh: 'บุคลิกภาพ' },
], {"title":"หมวดคำอ่าน","group":"ลายมือ","routes":["/horoscope/palmistry/"]});

export const GROUP_LABELS = { main: 'เส้นหลัก', minor: 'เส้นรอง' };
