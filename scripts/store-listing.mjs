// The Play store listing copy, in every language the app ships.
//
// Kept in the repo (not typed into the console by hand) for three reasons:
// it is reviewable in a diff, it is the same text a native speaker can be sent
// to check, and scripts/build-play-translations.mjs can emit the CSV Play's
// bulk translation import expects without anyone retyping it.
//
// App counts must come from the data, not from memory. The old docs said "145
// prayers across 15 traditions"; the app ships far more than that, so a hand-kept
// number is a number that goes stale and becomes a false claim on the store
// page. Counts are injected from the prayer data below.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// --- counts, read from the data -------------------------------------------
//
// Never hand-keep these. The README and docs/PLAY-STORE.md said "145 prayers across 15
// traditions" long after the catalogue had outgrown it, and a stale number on a
// store page is a false claim, not just untidy.
//
// The catalogue is one file per spirit group under src/data/spirits, and
// src/data/prayers.js lists the groups in picker order.
const SPIRITS_DIR = path.join(ROOT, 'src/data/spirits')
const SPIRIT_FILES = fs.readdirSync(SPIRITS_DIR).filter((f) => f.endsWith('.js'))

const prayersSrc = fs.readFileSync(path.join(ROOT, 'src/data/prayers.js'), 'utf8')
const spiritCodes = [...prayersSrc.matchAll(/id:\s*'([a-z]+)'/g)].map((m) => m[1])

let prayerCount = 0
for (const f of SPIRIT_FILES) {
  const src = fs.readFileSync(path.join(SPIRITS_DIR, f), 'utf8')
  // Count only the ids INSIDE `prayers: [`.
  //
  // Counting every `id:` in the file also matched the spirit's own top-level id
  // - one per file - so the listing over-stated the catalogue by the number of
  // traditions. It said 273 for 254 prayers, in all fifteen languages, and the
  // same wrong figure had been published before this. The count is the single
  // most public claim the app makes, so it is derived from the prayers array
  // itself rather than a pattern that happens to match.
  const prayersStart = src.indexOf('prayers: [')
  const body = prayersStart >= 0 ? src.slice(prayersStart) : ''
  prayerCount += (body.match(/\bid:\s*'/g) || []).length
}

// A spirit file with no entry in prayers.js would not be reachable from the
// picker, so it must not be advertised.
const orphanFiles = SPIRIT_FILES.map((f) => f.replace('.js', '')).filter(
  (id) => !spiritCodes.includes(id)
)
const missingFiles = spiritCodes.filter((id) => !SPIRIT_FILES.includes(id + '.js'))

const STATS = { prayers: prayerCount, spirits: spiritCodes.length }
const DATA_PROBLEMS = [...orphanFiles, ...missingFiles]

// A Latin run sitting directly against non-Latin text with no space is always a
// machine-translation artefact: the translator emitted the product name or an
// English word mid-word. "فيقفPrayerDISC" reached an earlier draft of this file
// and would have gone into the Arabic Play listing verbatim.
//
// Ordinary Latin in these scripts is fine (the product name, GDPR, "cookie"),
// so only the *welded* case is reported.
const NON_LATIN = /[\u0600-\u06FF\u0900-\u097F\u0F00-\u0FFF\u4E00-\u9FFF]/
const LATIN_WELDED = /[A-Za-z][\u0600-\u06FF\u0900-\u097F\u0F00-\u0FFF\u4E00-\u9FFF]|[\u0600-\u06FF\u0900-\u097F\u0F00-\u0FFF\u4E00-\u9FFF][A-Za-z]/

// A licence or version token legitimately abuts the surrounding script:
// Tibetan writes "AGPL-3.0ནས" with no space, and Japanese writes "AGPL-3.0 の".
// Those are not corruption. Corruption is an *alphabetic* Latin fragment welded
// mid-word, like "فيقفPrayerDISC" or "無料-geo針".
const LICENSE_OR_VERSION = /^(?:[A-Za-z]+-)?[A-Za-z]*\d[\w.-]*$|^(?:AGPL|GPL|MIT|CC|BSD|Apache|MPL)[\w.-]*$/

// Play's short description limit is 80 characters. Checked below, per language,
// because translations routinely overrun it and Play silently truncates.
const LIMIT = 80

// Substitute the real counts into every field.
//
// This has to actually RUN over the values. An earlier version attached the
// helper and never called it, so the CSV went to Play with a literal
// "{prayers}" sitting in the store description.
const count = (s) =>
  String(s)
    .replace(/\{prayers\}/g, String(prayerCount))
    .replace(/\{spirits\}/g, String(spiritCodes.length))

const RAW_LISTING = {
  en: {
    title: 'Joining Palms',
    short: 'Pray with the world. {prayers} prayers, {spirits} traditions, no ads.',
    full: `**Pray with the whole world.**

Joining Palms is a free, multilingual prayer app. Pick a tradition, press Pray, and your prayer becomes a light on a living Earth — so people praying in another language, another faith, or another country are beside you at the same moment.

**{prayers} prayers across {spirits} traditions**
Ancient and modern scripture, transliterated, with English meaning alongside. Adding prayers is open to anyone.

**A real-time 3D Earth**
WebGL, not a video. Every prayer is a light on the globe, the world glows brighter as more people join, and a soft golden aura rings it.

**Fifteen languages, right to left included**
English, Spanish, French, German, Portuguese, Italian, Russian, Chinese, Japanese, Korean, Hindi, Arabic (right-to-left), Vietnamese, Tagalog and Tibetan. The app follows your device language on first open.

**No account. No ads.**
There is no sign-up because there is no account to have. Your prayer record lives on your device, and you can erase it from the app in one tap — no email, no waiting. If you share location it is rounded to a coarse cell, never stored exactly, and you can turn it off in Settings.

**Works offline**
Pray on a plane. Everything is downloadable and works without a connection.

Free, no subscriptions, no in-app purchases. Installable, and open source under AGPL-3.0.`
  },

  es: {
    title: 'Joining Palms',
    short: 'Reza con el mundo. {prayers} oraciones, {spirits} tradiciones, sin anuncios.',
    full: `**Reza con todo el mundo.**

Joining Palms es una aplicación de oración gratuita y multilingüe. Elige una tradición, pulsa Rezar, y tu oración se convierte en una luz sobre una Tierra viva: así, quienes rezan en otro idioma, otra fe u otro país están a tu lado en el mismo momento.

**{prayers} oraciones en {spirits} tradiciones**
Escritura antigua y moderna, transliterada, con el significado en inglés al lado. Cualquiera puede añadir oraciones.

**Sin cuenta. Sin anuncios.**
No hay registro porque no hay cuenta que tener. Tu historial de oración vive en tu dispositivo y puedes borrarlo desde la aplicación con un toque: sin correo, sin esperas.

**Funciona sin conexión**
Reza en un avión. Todo se puede descargar y funciona sin conexión.

**En tu idioma**
Quince idiomas; la aplicación sigue el idioma de tu dispositivo al abrirla.

Gratis, sin suscripciones, sin compras dentro de la aplicación. Código fuente disponible bajo AGPL-3.0.`
  },

  fr: {
    title: 'Joining Palms',
    short: 'Priez avec le monde. {prayers} prières, {spirits} traditions, sans pub.',
    full: `**Priez avec le monde entier.**

Joining Palms est une application de prière gratuite et multilingue. Choisissez une tradition, appuyez sur Prier, et votre prière devient une lumière sur une Terre vivante : les personnes qui prient dans une autre langue, une autre foi ou un autre pays sont à vos côtés au même instant.

**{prayers} prières, {spirits} traditions**
Écritures anciennes et modernes, translittérées, avec le sens en anglais à côté. L'ajout de prières est ouvert à tous.

**Aucun compte. Aucune publicité.**
Pas d'inscription parce qu'il n'y a pas de compte à avoir. Votre historique de prière reste sur votre appareil et vous pouvez l'effacer depuis l'application en un geste : sans e-mail, sans attente.

**Fonctionne hors ligne**
Priez en avion. Tout est téléchargeable et fonctionne sans connexion.

**Dans votre langue**
Quinze langues ; l'application suit la langue de votre appareil à la première ouverture.

Gratuit, sans abonnement, sans achat intégré. Code source disponible sous AGPL-3.0.`
  },

  de: {
    title: 'Joining Palms',
    short: 'Bete mit der Welt. {prayers} Gebete, {spirits} Traditionen, keine Werbung.',
    full: `**Bete mit der ganzen Welt.**

Joining Palms ist eine kostenlose mehrsprachige Gebets-App. Wähle eine Tradition, tippe auf Beten, und dein Gebet wird zu einem Licht auf einer lebendigen Erde — Menschen, die in einer anderen Sprache, einem anderen Glauben oder einem anderen Land beten, stehen im selben Moment neben dir.

**{prayers} Gebete aus {spirits} Traditionen**
Alte und moderne Schriften, transkribiert, mit der englischen Bedeutung daneben. Gebete hinzuzufügen ist offen für alle.

**Kein Konto. Keine Werbung.**
Es gibt keine Anmeldung, weil es kein Konto gibt. Dein Gebetsverlauf bleibt auf deinem Gerät, und du kannst ihn mit einem Tippen in der App löschen — ohne E-Mail, ohne Warten.

**Funktioniert offline**
Bete im Flugzeug. Alles ist herunterladbar und funktioniert ohne Verbindung.

**In deiner Sprache**
Fünfzehn Sprachen; die App folgt beim ersten Öffnen der Sprache deines Geräts.

Kostenlos, ohne Abonnement, keine In-App-Käufe. Quellcode unter AGPL-3.0 verfügbar.`
  },

  pt: {
    title: 'Joining Palms',
    short: 'Reze com o mundo. {prayers} orações, {spirits} tradições, sem anúncios.',
    full: `**Reze com o mundo inteiro.**

O Joining Palms é um aplicativo de oração gratuito e multilíngue. Escolha uma tradição, toque em Rezar, e sua oração vira uma luz sobre uma Terra viva — quem reza em outra língua, outra fé ou outro país está ao seu lado no mesmo instante.

**{prayers} orações em {spirits} tradições**
Escrituras antigas e modernas, transliteradas, com o sentido em inglês ao lado. Qualquer pessoa pode adicionar orações.

**Sem conta. Sem anúncios.**
Não há cadastro porque não há conta a ter. Seu histórico de oração fica no seu aparelho, e você pode apagá-lo no aplicativo com um toque — sem e-mail, sem espera.

**Funciona offline**
Reze em um avião. Tudo pode ser baixado e funciona sem conexão.

**No seu idioma**
Quinze idiomas; o aplicativo segue o idioma do aparelho na primeira abertura.

Gratuito, sem assinatura, sem compras no aplicativo. Código-fonte disponível sob AGPL-3.0.`
  },

  it: {
    title: 'Joining Palms',
    short: 'Prega con il mondo. {prayers} preghiere, {spirits} tradizioni, niente pub.',
    full: `**Prega con tutto il mondo.**

Joining Palms è un'app di preghiera gratuita e multilingue. Scegli una tradizione, premi Prega, e la tua preghiera diventa una luce su una Terra viva: chi prega in un'altra lingua, un'altra fede o un altro paese è accanto a te nello stesso momento.

**{prayers} preghiere in {spirits} tradizioni**
Scritture antiche e moderne, traslitterate, con il significato in inglese accanto. Aggiungere preghiere è aperto a tutti.

**Nessun account. Nessun annuncio.**
Non c'è registrazione perché non c'è un account da avere. Il tuo registro di preghiera resta sul tuo dispositivo e puoi cancellarlo dall'app con un tocco: senza email, senza attese.

**Funziona offline**
Prega in aereo. Tutto è scaricabile e funziona senza connessione.

**Nella tua lingua**
Quindici lingue; l'app segue la lingua del dispositivo alla prima apertura.

Gratuita, senza abbonamenti, senza acquisti in-app. Codice sorgente disponibile sotto AGPL-3.0.`
  },

  ru: {
    title: 'Joining Palms',
    short: 'Молитесь вместе с миром. {prayers} молитв, {spirits} традиций, без рекламы.',
    full: `**Молитесь со всем миром.**

Joining Palms — бесплатное многоязычное приложение для молитвы. Выберите традицию, нажмите «Молиться», и ваша молитва станет огоньком на живой Земле — те, кто молится на другом языке, в другой вере или в другой стране, оказываются рядом с вами в тот же момент.

**{prayers} молитв из {spirits} традиций**
Древние и современные тексты, транслитерация, с переводом на английский рядом. Добавлять молитвы может любой.

**Без аккаунта. Без рекламы.**
Регистрации нет, потому что нет и аккаунта. Ваша история молитв хранится на устройстве, и её можно стереть из приложения одним нажатием — без писем и ожидания.

**Работает без сети**
Молитесь в самолёте. Всё можно скачать заранее, и приложение работает без подключения.

**На вашем языке**
Пятнадцать языков; при первом запуске приложение определяет язык устройства.

Бесплатно, без подписок и покупок в приложении. Исходный код доступен по AGPL-3.0.`
  },

  zh: {
    title: 'Joining Palms',
    short: '与世界一起祈祷。{prayers} 篇祈祷文，{spirits} 种传统，无广告。',
    full: `**与世界一同祈祷。**

Joining Palms 是一款免费的多语言祈祷应用。选择一种传统，点击「祈祷」，你的祈祷便化作一颗光点，落在真实的地球上——此刻，用另一种语言、另一种信仰或身处另一个国家祈祷的人，就在你身边。

**{prayers} 篇祈祷文，涵盖 {spirits} 种传统**
古老与现代的经文，附转写与英文释义。任何人都可以添加祈祷文。

**无需账号、无广告**
没有注册，因为根本没有账号。你的祈祷记录保存在你的设备上，在应用内一键即可删除——不用发邮件，不用等待。

**离线可用**
在飞机上也能祈祷。所有内容均可预先下载，无网络也能使用。

**用你的语言**
支持十五种语言；首次打开时，应用会跟随你的设备语言。

免费，无订阅，无应用内购买。源码以 AGPL-3.0 授权开放。`
  },

  ar: {
    title: 'Joining Palms',
    short: 'صلِّ مع العالم. {prayers} صلاة، {spirits} تقاليد، بلا إعلانات.',
    full: `**صلِّ مع العالم بأسره.**

Joining Palms تطبيق صلاة مجاني ومتعدد اللغات. اختر تقليدًا، واضغط «صلِّ»، فتصبح صلاتك نورًا على أرض حيّة — فيكونون الذين يصلّون بلغة أخرى أو إيمان آخر أو في بلد آخر إلى جانبك في اللحظة نفسها.

**{prayers} صلاة عبر {spirits} تقاليد**
نصوص قديمة وحديثة، مع النقحرف والمعنى الإنجليزي إلى جانبها. وإضافة الصلوات مفتوحة للجميع.

**بلا حساب، بلا إعلانات**
لا تسجيل لأن لا حساب أصلًا. سجل صلاتك يبقى على جهازك، ويمكنك محوه من التطبيق بلمسة واحدة — بلا بريد، بلا انتظار.

**يعمل دون اتصال**
صلِّ في الطائرة. كل شيء قابل للتنزيل ويعمل بلا اتصال.

**بلغتك**
خمس عشرة لغة؛ يتبع التطبيق لغة جهازك عند أول فتح.

مجاني، بلا اشتراكات، بلا مشتريات داخل التطبيق. الشيفرة متاحة برخصة AGPL-3.0.`
  },

  ja: {
    title: 'Joining Palms',
    short: '世界と共に祈る。{prayers}の祈り、{spirits}の伝統、広告なし。',
    full: `**世界と共に祈る。**

Joining Palms は無料で多言語対応の祈りアプリです。伝統を選び「祈る」を押すと、あなたの祈りは生きている地球の上の光となります ── 別の言語、別の信仰、別の国的人在、同じ瞬間にあなたの隣で祈っています。

**{spirits}の伝統にわたる{prayers}の祈り**
古い経文と現代の日々を翻刻し、英語の訳を添えています。祈りの追加は誰でもできます。

**アカウント不要、広告なし**
アカウントがないため、登録もありません。祈りの記録は端末内に保存され、アプリからワンタップで削除できます ── メールも、待ち時間も不要です。

**オフラインでも使える**
機内でも祈れます。すべてダウンロードでき、接続なしで動作します。

**あなたの言語で**
15言語に対応。初回起動時に端末の言語に合わせます。

無料。サブスクリプションもアプリ内購入もありません。ソースは AGPL-3.0 で公開しています。`
  },

  ko: {
    title: 'Joining Palms',
    short: '세계와 함께 기도하세요. 기도 {prayers}개, 전통 {spirits}종, 광고 없음.',
    full: `**세계와 함께 기도하세요.**

Joining Palms는 무료 다국어 기도 앱입니다. 전통을 고르고 '기도하기'를 누르면, 당신의 기도가 살아 있는 지구 위의 한 점이 됩니다 ── 다른 언어와 다른 신앙, 다른 나라에서 기도하는 사람들이 바로 그 순간 당신 곁에 있습니다.

**{spirits}개 전통의 기도 {prayers}개**
고전과 현대의 경문을 음차로 옮기고 영어 뜻을 함께 실었습니다. 기도는 누구나 추가할 수 있습니다.

**계정 없음, 광고 없음**
계정이 없으니 가입도 없습니다. 기도 기록은 기기 안에 있으며, 앱에서 한 번의 탭으로 지울 수 있습니다 ── 이메일도, 기다림도 없습니다.

**오프라인에서도 작동**
비행기에서도 기도할 수 있습니다. 모두 미리 내려받아 연결 없이 동작합니다.

**당신의 언어로**
15개 언어 지원. 처음 열 때 기기 언어를 따릅니다.

무료, 구독도 인앱 구매도 없습니다. 소스는 AGPL-3.0으로 제공됩니다.`
  },

  hi: {
    title: 'Joining Palms',
    short: 'दुनिया के साथ प्रार्थना। {prayers} प्रार्थनाएँ, {spirits} परंपराएँ।',
    full: `**पूरी दुनिया के साथ प्रार्थना करें।**

Joining Palms एक निःशुल्क, बहुभाषिक प्रार्थना ऐप है। कोई परंपरा चुनें, प्रार्थना करें दबाएँ, और आपकी प्रार्थना एक जीवित पृथ्वी पर एक प्रकाश बन जाती है — दूसरी भाषा, दूसरे धर्म या दूसरे देश में प्रार्थना करने वाले लोग उसी क्षण आपके साथ खड़े होते हैं।

**{spirits} परंपराओं में {prayers} प्रार्थनाएँ**
प्राचीन और आधुनिक धर्मग्रंथ, रोमन लिपि में, साथ में अंग्रेज़ी अर्थ के साथ। प्रार्थनाएँ जोड़ना सबके लिए खुला है।

**कोई खाता नहीं। कोई विज्ञापन नहीं।**
खाता ही नहीं है, इसलिए साइन-अप भी नहीं। आपका प्रार्थना रिकॉर्ड आपके डिवाइस पर रहता है, और आप ऐप में एक टैप में उसे मिटा सकते हैं — न ईमेल, न इंतज़ार।

**ऑफ़लाइन भी चलता है**
प्लेन में भी प्रार्थना करें। सब कुछ पहले डाउनलोड हो सकता है और बिना कनेक्शन चलता है।

**आपकी भाषा में**
पंद्रह भाषाएँ; पहली बार खोलते ही ऐप आपके डिवाइस की भाषा अपना लेता है।

निःशुल्क, कोई सदस्यता नहीं, कोई इन-ऐप खरीद नहीं। स्रोत AGPL-3.0 के अंतर्गत उपलब्ध।`
  },

  vi: {
    title: 'Joining Palms',
    short: 'Cầu cùng thế giới. {prayers} lời, {spirits} truyền thống, miễn phí.',
    full: `**Cầu nguyện cùng cả thế giới.**

Joining Palms là ứng dụng cầu nguyện miễn phí, đa ngôn ngữ. Chọn một truyền thống, bấm Cầu nguyện, và lời cầu của bạn trở thành một đốm sáng trên Trái Đất sống — những người đang cầu nguyện bằng ngôn ngữ khác, tín ngưỡng khác, hay ở nước khác, đều ở ngay bên cạnh bạn trong khoảnh khắc ấy.

**{prayers} lời cầu nguyện thuộc {spirits} truyền thống**
Kinh cổ và hiện đại, có chuyển tự Latin, kèm nghĩa tiếng Anh. Ai cũng có thể thêm lời cầu nguyện.

**Không tài khoản. Không quảng cáo.**
Không có đăng ký vì không có tài khoản nào để có. Lịch sử cầu nguyện của bạn nằm trong thiết bị, và bạn có thể xóa ngay trong ứng dụng — không email, không chờ đợi.

**Hoạt động ngoại tuyến**
Cầu nguyện ngay trên máy bay. Mọi thứ đều tải trước được và chạy không cần mạng.

**Bằng ngôn ngữ của bạn**
Mười lăm ngôn ngữ; ứng dụng theo ngôn ngữ thiết bị khi mở lần đầu.

Miễn phí, không đăng ký, không mua trong ứng dụng. Mã nguồn theo giấy phép AGPL-3.0.`
  },

  tl: {
    title: 'Joining Palms',
    short: 'Magdasal nang mundo. {prayers} dasal, {spirits} tradisyon, walang anunsyo.',
    full: `**Magdasal nang kasama ang buong mundo.**

Ang Joining Palms ay libre at maraming-wika na app ng dasal. Pumili ng tradisyon, pindutin ang Magdasal, at ang iyong dasal ay magiging isang liwanag sa isang buhay na Daigdig — ang mga nagdadasal sa ibang wika, ibang pananampalataya, o ibang bansa ay nasa tabi mo sa parehong sandali.

**{prayers} na dasal sa {spirits} tradisyon**
Lumang at makabagong kasulatan, isinulat sa Roman, at may kabuhayan sa Ingles. Bukas sa lahat ang pagdagdag ng dasal.

**Walang account. Walang anunsyo.**
Walang pagpaparehistro dahil walang account na dapat magkaroon. Nasa device mo ang talaan ng iyong dasal, at mura-mura mo itong burahin sa app: walang email, walang paghihintay.

**Gumagana kahit walang internet**
Magdasal ka sa eroplano. Maaaring i-download ang lahat at gumagana nang walang koneksyon.

**Sa wika mo**
Labing-limang wika; sumusunod ang app sa wika ng device mo sa unang pagbukas.

Libre, walang subscription, walang biniling sa app. Available ang source sa ilalim ng AGPL-3.0.`
  },

  bo: {
    title: 'Joining Palms',
    short: 'སྐྱབས་འགྲོ་དང་འདབས། {prayers} སྐྱབས། {spirits} ལམ་སྲོལ། རྒྱག་ཆེན་མེད།',
    full: `**འཛམ་གླིང་དང་བཅས་ན་སྐྱབས་འགྲོ།**

Joining Palms ནི་རིན་མེད་ཀྱི་ཡིག་སྐད་མང་པོའི་སྐྱབས་ཀྱི་ཁུལ། ལམ་སྲོལ་ཞིག་གཞུགས་པའམ། སྐྱབས་འགྲོ་ཞེས་མཛད་པའང་ཁྱེད་ཀྱི་སྐྱབས་ནི་གནས་སུ་གནས་པའི་སངས་རྒྱས་ཞིག་ཏུ་འགྱུར། — གཞན་སྐད། གཞན་ལམ་སྲོལ་ཡང་ན་གཞན་རྒྱལ་དུ་ཡོད་མཁན་གྱིས་དེ་དགོན་མཚན་གཉིས་ཀྱི་མཛུབ་སུ་ཁྱེད་དང་མཉམ་དུ་རེད།

**{spirits} ལམ་སྲོལ་ཀྱི་ {prayers} སྐྱབས་སོག**
གོང་དུམ་དང་ཁྱོད་རེའི་ལུང་གིས་བཟོས་པའམ། དངོས་མཚོན་གྱི་བསྟན་བྱ་ཐིམ་པའི་ཕྱོགས་བདག་སོགས། སྐྱབས་བསྲེལ་བརྒྱུད་དགོང་བཀོར་ཡོད།

**བསྡུས་ཀྱི་མེད། རྒྱག་ཆེན་མེད།**
བསྡུས་ཀྱི་མེད་པས་ལོ་འཛུལ་ཀྱི་དགོང་མེད། ཁྱེད་ཀྱི་སྐྱབས་ཀྱི་ལས་ཐོག་ནི་ཁྱེད་ཀྱི་སྟེ་གེར་འདིར་གནས། དེས་ན་ཁུལ་དངོས་ཀྱིས་སྦག་ཏེར་གཅིག་ཀྱིས་འཁྲེག་ཐུག་མེད་ཀྱི་འཇོག་ཏེན།

**ཁ་མེད་ཀྱང་འགྲོ་འདུག**
འདུས་གནས་ཀྱི་ནང་སོགས་ཀྱང་སྐྱབས་འགྲོ་ཐུབ། ཡོད་ཚང་མ་འདམས་ཀྱིས་འཇོག་ཐུབ།

**ཁྱེད་ཀྱི་སྐད་ཡིག**
བཅོ་ལྡན་དཔར་སྐད་ཡིག། ཐོག་མཛོད་སྐབས་སུ་ཁུལ་གྱི་སྐད་ཡིག་ལྟར་འགྲོ།

རིན་མེད། འཆར་ཚོགས་མེད། ཁུལ་ནང་ཉོ་ཚོང་མེད། ཡོན་ཏན་ཀྱི་ཀོག་མཚོན་ནི་AGPL-3.0ནས་འགོ་བ།`
  }
}

// Apply the substitution now, per field. Doing it here rather than defining a
// helper nobody calls is the whole point: the previous version defined one and
// never invoked it, and the store description shipped a literal "{prayers}".
const LISTING = Object.fromEntries(
  Object.entries(RAW_LISTING).map(([code, v]) => [
    code,
    { title: count(v.title), short: count(v.short), full: count(v.full) }
  ])
)
export const STORE_LISTING = LISTING
export const LISTING_STATS = STATS
export const SHORT_LIMIT = LIMIT

if (process.argv[1] && process.argv[1].endsWith('store-listing.mjs')) {
  console.log('prayers:', prayerCount, 'traditions:', spiritCodes.length)
  if (DATA_PROBLEMS.length) console.log('DATA PROBLEM:', DATA_PROBLEMS.join(', '))
  let anyOver = false
  for (const [code, v] of Object.entries(LISTING)) {
    const short = v.short
    const over = short.length > LIMIT
    if (over) anyOver = true
    console.log(
      `  ${code}  short=${String(short.length).padStart(3)}  title=${v.title.length}  ${over ? 'OVER LIMIT' : 'ok'}`
    )
  }

  // Corruption scan, per language per field.
  let corrupt = 0
  for (const [code, v] of Object.entries(LISTING)) {
    for (const [field, text] of Object.entries(v)) {
      const s = String(text)
      const marks = []
      if (s.includes('\uFFFD')) marks.push('replacement character')
      if (/\{(prayers|spirits)\}/.test(s)) marks.push('unsubstituted {prayers}')
      if (NON_LATIN.test(s)) {
        // Fresh regex each time: a global regex carries lastIndex across .test()
        // calls and silently skips matches.
        const welded = /[A-Za-z][\u0600-\u06FF\u0900-\u097F\u0F00-\u0FFF\u4E00-\u9FFF]|[\u0600-\u06FF\u0900-\u097F\u0F00-\u0FFF\u4E00-\u9FFF][A-Za-z]/g
        for (const m of s.matchAll(welded)) {
          // Pull the whole Latin word out of the boundary match.
          const around = s.slice(Math.max(0, m.index - 12), m.index + m[0].length + 12)
          const latinWord = (around.match(/[A-Za-z][A-Za-z0-9._-]*/g) || []).find(
            (w) => LICENSE_OR_VERSION.test(w)
          )
          if (latinWord) continue
          marks.push('Latin welded to non-Latin: "' + m[0] + '"')
        }
      }
      for (const m of marks) {
        corrupt++
        console.log(`  CORRUPT  [${code}] ${field}: ${m}`)
      }
    }
  }
  console.log(corrupt ? `${corrupt} corruption findings` : 'no corruption findings')
  if (DATA_PROBLEMS.length || corrupt || anyOver) process.exit(1)
}