// Localized prayer descriptions, keyed by prayerId -> locale -> text.
// English in src/data/prayers.js is the source of truth; these override the
// description shown when a locale is active. Partial coverage is fine — the
// English text is the fallback. Add more prayers/locales over time.

export const PRAYER_L10N = {
  'lords-prayer': {
    es: 'La oración que Jesús enseñó a sus discípulos: pan de cada día, perdón y confianza en un Dios amoroso.',
    fr: 'La prière enseignée par Jésus à ses disciples : le pain quotidien, le pardon et la confiance en un Dieu d\u2019amour.',
    de: 'Das Gebet, das Jesus seine Jünger lehrte: tägliches Brot, Vergebung und Vertrauen in einen liebenden Gott.',
    pt: 'A oração que Jesus ensinou aos seus discípulos: o pão de cada dia, o perdão e a confiança em um Deus amoroso.',
    it: 'La preghiera insegnata da Gesù ai suoi discepoli: il pane quotidiano, il perdono e la fiducia in un Dio amoroso.',
    ru: 'Молитва, которой Иисус научил учеников: хлеб насущный, прощение и доверие любящему Богу.',
    hi: 'यीशु द्वारा शिष्यों को सिखाई गई प्रार्थना: दैनिक रोटी, क्षमा और प्रेममय ईश्वर पर विश्वास।',
    zh: '耶稣教导门徒的祈祷：日用的饮食、饶恕，以及对慈爱上帝的信任。',
    ar: 'الصلاة التي علّمها يسوع تلاميذه: الخبز اليومي، الغفران، والثقة بإله محب.',
    ja: 'イエスが弟子たちに教えた祈り。日々の糧、ゆるし、愛する神への信頼。',
    ko: '예수님께서 제자들에게 가르치신 기도: 일용할 양식, 용서, 사랑의 하느님에 대한 신뢰.'
  },
  'al-fatiha': {
    es: 'El capítulo que abre el Corán, recitado en cada oración del día.',
    fr: 'Le chapitre qui ouvre le Coran, récité à chaque prière de la journée.',
    de: 'Das eröffnende Kapitel des Koran, bei jedem Gebet des Tages rezitiert.',
    pt: 'O capítulo que abre o Alcorão, recitado em cada oração do dia.',
    it: 'Il capitolo che apre il Corano, recitato in ogni preghiera del giorno.',
    ru: 'Глава, открывающая Коран, читаемая в каждой молитве дня.',
    hi: 'क़ुरआन का आरंभिक अध्याय, दिन की हर प्रार्थना में पढ़ा जाता है।',
    zh: '《古兰经》的开篇章，每日每次祈祷都诵读。',
    ar: 'الفصل الذي يفتتح القرآن، يُتلى في كل صلاة من اليوم.',
    ja: 'コーランを開く章。一日のすべての祈りで唱えられる。',
    ko: '꾸란을 여는 장, 하루의 모든 기도에서 낭송됩니다.'
  },
  'gayatri': {
    es: 'El mantra más sagrado de los Vedas, que invoca la luz de la sabiduría para guiar la mente.',
    fr: 'Le mantra le plus sacré des Védas, invoquant la lumière de la sagesse pour guider l\u2019esprit.',
    de: 'Das heiligste Mantra der Veden, das das Licht der Weisheit anruft, um den Geist zu leiten.',
    pt: 'O mantra mais sagrado dos Vedas, invocando a luz da sabedoria para guiar a mente.',
    it: 'Il mantra più sacro dei Veda, che invoca la luce della saggezza per guidare la mente.',
    ru: 'Самый священный мантр Вед, призывающий свет мудрости вести ум.',
    hi: 'वेदों का सबसे पवित्र मंत्र, मन को मार्गदर्शन देने के लिए ज्ञान के प्रकाश का आह्वान।',
    zh: '《吠陀》最神圣的曼陀罗，呼唤智慧之光指引心灵。',
    ar: 'أقدس مانترا في الفيدا، يستدعي نور الحكمة لهداية العقل.',
    ja: 'ヴェーダで最も神聖なマントラ。心を導く智恵の光を呼び求める。',
    ko: '베다에서 가장 신성한 만트라, 마음을 인도하는 지혜의 빛을 부릅니다.'
  },
  'mani': {
    es: 'El mantra de la compasión: la joya en el loto, invocado por el bien de todos los seres.',
    fr: 'Le mantra de la compassion : le joyau dans le lotus, invoqué pour tous les êtres.',
    de: 'Das Mantra des Mitgefühls: das Juwel im Lotus, angerufen zum Wohl aller Wesen.',
    pt: 'O mantra da compaixão: a joia no lótus, invocado pelo bem de todos os seres.',
    it: 'Il mantra della compassione: il gioiello nel loto, invocato per il bene di tutti gli esseri.',
    ru: 'Мантра сострадания: жемчужина в лотосе, призываемая на благо всех существ.',
    hi: 'करुणा का मंत्र: कमल में मणि, सभी प्राणियों की भलाई के लिए जपा जाता है।',
    zh: '慈悲的咒语：莲中珍宝，为一切众生而诵。',
    ar: 'مانترا الرحمة: الجوهرة في اللوتس، تُتلى لخير كل الكائنات.',
    ja: '慈悲のマントラ。蓮の中の宝珠、すべての生きとし生けるもののために唱えられる。',
    ko: '자비의 만트라: 연꽃 속의 보석, 모든 존재의 행복을 위해 외웁니다.'
  },
  'metta-sutta': {
    es: 'El discurso del Buda sobre el amor bondadoso: el deseo de que todos los seres, sin excepción, estén bien.',
    fr: 'Le discours du Bouddha sur l\u2019amour bienveillant : le vœu que tous les êtres, sans exception, soient heureux.',
    de: 'Die Lehrrede des Buddha über liebende Güte: der Wunsch, dass alle Wesen ohne Ausnahme wohlbehalten seien.',
    pt: 'O discurso do Buda sobre o amor bondoso: o desejo de que todos os seres, sem exceção, estejam bem.',
    it: 'Il discorso del Buddha sull\u2019amore benevolo: il desiderio che tutti gli esseri, senza eccezione, stiano bene.',
    ru: 'Речь Будды о доброте и любви: пожелание, чтобы все существа без исключения были благополучны.',
    hi: 'बुद्ध का करुणा-प्रेम का उपदेश: यह कामना कि सभी प्राणी, बिना किसी अपवाद के, सुखी रहें।',
    zh: '佛陀的慈爱开示：愿一切众生，无一例外，都安好。',
    ar: 'خطبة بوذا عن المحبة الرحيمة: أن يتمنى أن يكون كل الكائنات، دون استثناء، بخير.',
    ja: 'ブッダの慈しみの経。すべての生きとし生けるものが、例外なく幸せであるようにとの願い。',
    ko: '부처님의 자애 설법: 모든 존재가 예외 없이 평안하기를 바라는 마음.'
  }
}

// The localized description for a prayer, falling back to its English text.
export const tPrayer = (prayer, locale) =>
  (PRAYER_L10N[prayer?.id] && PRAYER_L10N[prayer.id][locale]) || prayer?.translation
