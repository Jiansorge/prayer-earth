// Prayers of the world.
// Each phrase: { t: text spoken aloud, s?: subtitle shown (e.g. transliteration), e?: meaning }
// spirituality.prayers[x].lang = BCP-47 code used by the speech engine.

export const SPIRITUALITIES = [
  {
    id: 'christianity',
    name: 'Christianity',
    emoji: '✝️',
    glow: 'rgba(201, 160, 60, 0.28)',
    lightColor: '#e8c47a',
    tagline: 'Grace, love, and the still small voice.',
    prayers: [
      {
        id: 'lords-prayer',
        title: "The Lord's Prayer",
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Our Father, who art in heaven,' },
          { t: 'hallowed be thy name.' },
          { t: 'Thy kingdom come,' },
          { t: 'thy will be done,' },
          { t: 'on earth as it is in heaven.' },
          { t: 'Give us this day our daily bread,' },
          { t: 'and forgive us our trespasses,' },
          { t: 'as we forgive those who trespass against us.' },
          { t: 'And lead us not into temptation,' },
          { t: 'but deliver us from evil.' },
          { t: 'For thine is the kingdom, and the power,' },
          { t: 'and the glory, for ever and ever.' },
          { t: 'Amen.' }
        ],
        translation: 'A prayer taught by Jesus to his disciples — of daily bread, forgiveness, and trust in a loving God.'
      },
      {
        id: 'jesus-prayer',
        title: 'The Jesus Prayer',
        lang: 'en',
        langLabel: 'English · a breath-prayer, repeated',
        loop: true,
        phrases: [
          { t: 'Lord Jesus Christ, Son of God,' },
          { t: 'have mercy on me, a sinner.' }
        ],
        translation: 'The ancient prayer of the heart of Eastern Christianity — one phrase on the in-breath, one on the out-breath.'
      },
      {
        id: 'psalm-23',
        title: 'Psalm 23',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'The Lord is my shepherd; I shall not want.' },
          { t: 'He makes me lie down in green pastures.' },
          { t: 'He leads me beside still waters;' },
          { t: 'he restores my soul.' },
          { t: 'Even though I walk through the darkest valley,' },
          { t: 'I fear no evil, for you are with me.' },
          { t: 'Your rod and your staff, they comfort me.' },
          { t: 'Surely goodness and mercy shall follow me' },
          { t: 'all the days of my life.' },
          { t: 'Amen.' }
        ],
        translation: 'A psalm of quiet trust — the shepherd who guides, provides, and stays near.'
      },
      {
        id: 'peace-prayer',
        title: 'The Peace Prayer of St. Francis',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Lord, make me an instrument of your peace.' },
          { t: 'Where there is hatred, let me sow love;' },
          { t: 'where there is injury, pardon;' },
          { t: 'where there is doubt, faith;' },
          { t: 'where there is despair, hope;' },
          { t: 'where there is darkness, light;' },
          { t: 'and where there is sadness, joy.' }
        ],
        translation: 'A beloved prayer of peace and humility, offered across every tradition of service.'
      },
      {
        id: 'ave-maria',
        title: 'Ave Maria',
        lang: 'la',
        langLabel: 'Latina · Latin',
        phrases: [
          { t: 'Ave Maria, gratia plena,', e: 'Hail Mary, full of grace,' },
          { t: 'Dominus tecum.', e: 'the Lord is with thee.' },
          { t: 'Benedicta tu in mulieribus,', e: 'Blessed art thou among women,' },
          { t: 'et benedictus fructus ventris tui, Iesus.', e: 'and blessed is the fruit of thy womb, Jesus.' },
          { t: 'Sancta Maria, Mater Dei, ora pro nobis peccatoribus,', e: 'Holy Mary, Mother of God, pray for us sinners,' },
          { t: 'nunc et in hora mortis nostrae. Amen.', e: 'now and at the hour of our death. Amen.' }
        ],
        translation: 'The great Marian prayer of the Church — a greeting of grace and a plea for intercession.'
      },
      {
        id: 'serenity',
        title: 'The Serenity Prayer',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'God, grant me the serenity to accept the things I cannot change,' },
          { t: 'courage to change the things I can,' },
          { t: 'and wisdom to know the difference.' },
          { t: 'Living one day at a time,' },
          { t: 'enjoying one moment at a time,' },
          { t: 'accepting hardship as the pathway to peace.' }
        ],
        translation: 'A twentieth-century prayer adopted by every tradition of recovery — for acceptance, courage, and wisdom.'
      },
      {
        id: 'magnificat',
        title: 'The Magnificat',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'My soul magnifies the Lord,' },
          { t: 'and my spirit rejoices in God my Savior.' },
          { t: 'For he has looked on the humble estate of his servant.' },
          { t: 'He has scattered the proud in the thoughts of their hearts;' },
          { t: 'he has brought down the mighty from their thrones' },
          { t: 'and exalted those of humble estate.' },
          { t: 'He has filled the hungry with good things.' }
        ],
        translation: "Mary's song of praise — a hymn of joy for the world turned right-side up."
      }
    ]
  },
  {
    id: 'islam',
    name: 'Islam',
    emoji: '☪️',
    glow: 'rgba(80, 200, 160, 0.28)',
    lightColor: '#5fd4a0',
    tagline: 'Surrender, peace, and the Mercy of God.',
    prayers: [
      {
        id: 'al-fatiha',
        title: 'Al-Fātiḥah — The Opening',
        lang: 'ar',
        langLabel: 'العربية · Arabic',
        phrases: [
          { t: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', s: 'Bismillāhir-raḥmānir-raḥīm', e: 'In the name of God, the Most Gracious, the Most Merciful.' },
          { t: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ', s: 'Al-ḥamdu lillāhi rabbil-ʿālamīn', e: 'All praise is for God, Lord of all the worlds.' },
          { t: 'الرَّحْمَٰنِ الرَّحِيمِ', s: 'Ar-raḥmānir-raḥīm', e: 'The Most Gracious, the Most Merciful.' },
          { t: 'مَالِكِ يَوْمِ الدِّينِ', s: 'Māliki yawmid-dīn', e: 'Master of the Day of Judgment.' },
          { t: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ', s: 'Iyyāka naʿbudu wa-iyyāka nastaʿīn', e: 'You alone we worship, and You alone we ask for help.' },
          { t: 'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ', s: 'Ihdināṣ-ṣirāṭal-mustaqīm', e: 'Guide us along the straight path.' },
          { t: 'صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ', s: 'Ṣirāṭal-laḏīna anʿamta ʿalayhim, ghayril-maghḍūbi ʿalayhim wa-laḍ-ḍāllīn', e: 'The path of those You have blessed — not those who earned anger, nor those astray.' }
        ],
        translation: 'The opening chapter of the Qurʼan, recited in every prayer of the day.'
      },
      {
        id: 'ayat-al-kursi',
        title: 'Āyat al-Kursī — The Throne Verse',
        lang: 'ar',
        langLabel: 'العربية · Arabic',
        phrases: [
          { t: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ', s: 'Allāhu lā ilāha illā huwal-ḥayyul-qayyūm', e: 'God — there is no deity except Him, the Ever-Living, the Sustainer of all.' },
          { t: 'لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ', s: 'Lā taʾkhuḏuhū sinatun wa-lā nawm', e: 'Neither drowsiness nor sleep overtakes Him.' },
          { t: 'لَهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ', s: 'Lahū mā fis-samāwāti wa-mā fil-arḍ', e: 'To Him belongs all that is in the heavens and all that is on the earth.' },
          { t: 'وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ', s: 'Wasiʿa kursiyyuhus-samāwāti wal-arḍ', e: 'His throne extends over the heavens and the earth.' },
          { t: 'وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ', s: 'Wa-lā yaʾūduhū ḥifẓuhumā, wa-huwal-ʿaliyyul-ʿaẓīm', e: 'Their preservation does not tire Him, for He is the Most High, the Magnificent.' }
        ],
        translation: 'A verse treasured across the Muslim world as a shield and a prayer of trust.'
      },
      {
        id: 'durood',
        title: 'Salawāt — Blessings on the Prophet',
        lang: 'ar',
        langLabel: 'العربية · Arabic · repeated',
        loop: true,
        phrases: [
          { t: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ', s: 'Allāhumma ṣalli ʿalā Muḥammadin wa-ʿalā āli Muḥammad', e: 'O God, send blessings upon Muhammad and the family of Muhammad.' },
          { t: 'كَمَا صَلَّيْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ', s: 'Kamā ṣallayta ʿalā Ibrāhīma wa-ʿalā āli Ibrāhīm', e: 'Just as You blessed Ibrahim and the family of Ibrahim.' },
          { t: 'إِنَّكَ حَمِيدٌ مَجِيدٌ', s: 'Innaka ḥamīdun majīd', e: 'Truly You are Praiseworthy, Glorious.' }
        ],
        translation: 'A prayer of blessing recited by Muslims around the world, morning and evening.'
      },
      {
        id: 'dua-yunus',
        title: "Du'a of Yūnus — The Prophet's Call",
        lang: 'ar',
        langLabel: 'العربية · Arabic · repeated',
        loop: true,
        phrases: [
          { t: 'لَا إِلَٰهَ إِلَّا أَنتَ سُبْحَانَكَ إِنِّي كُنتُ مِنَ الظَّالِمِينَ', s: 'Lā ilāha illā anta subḥānaka innī kuntu minaẓ-ẓālimīn', e: 'There is no god but You. Glory be to You — indeed, I was among the wrongdoers.' }
        ],
        translation: 'The cry of the Prophet Jonah from the depths, answered by mercy — a prayer of total turning back to God.'
      },
      {
        id: 'al-ikhlas',
        title: 'Sūrat al-Ikhlāṣ — Purity',
        lang: 'ar',
        langLabel: 'العربية · Arabic · repeated',
        loop: true,
        phrases: [
          { t: 'قُلْ هُوَ اللَّهُ أَحَدٌ', s: 'Qul huwa Allāhu aḥad', e: 'Say: He is God, the One.' },
          { t: 'اللَّهُ الصَّمَدُ', s: 'Allāhuṣ-ṣamad', e: 'God, the Eternal Refuge.' },
          { t: 'لَمْ يَلِدْ وَلَمْ يُولَدْ', s: 'Lam yalid wa-lam yūlad', e: 'He neither begets nor is born.' },
          { t: 'وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ', s: 'Wa-lam yakun lahū kufuwan aḥad', e: 'And there is none comparable to Him.' }
        ],
        translation: 'The chapter of Divine Unity — called by the Prophet equal to a third of the Qurʼan.'
      },
      {
        id: 'istighfar',
        title: 'Istighfar — Seeking Forgiveness',
        lang: 'ar',
        langLabel: 'العربية · Arabic · repeated',
        loop: true,
        phrases: [
          { t: 'أَسْتَغْفِرُ اللَّهَ', s: 'Astaghfirullāh', e: 'I seek Godʼs forgiveness.' },
          { t: 'أَسْتَغْفِرُ اللَّهَ رَبِّي مِنْ كُلِّ ذَنْبٍ وَأَتُوبُ إِلَيْهِ', s: 'Astaghfirullāha rabbī min kulli dhambin wa-atūbu ilayh', e: 'I seek forgiveness from God, my Lord, for every sin, and I turn to Him.' }
        ],
        translation: 'The simple, endless act of turning — seeking forgiveness, then turning again to God.'
      },
      {
        id: 'al-falaq',
        title: 'Sūrat al-Falaq — The Daybreak',
        lang: 'ar',
        langLabel: 'العربية · Arabic',
        phrases: [
          { t: 'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ', s: 'Qul aʿūdhu bi-rabbil-falaq', e: 'Say: I seek refuge in the Lord of the daybreak,' },
          { t: 'مِن شَرِّ مَا خَلَقَ', s: 'Min sharri mā khalaq', e: 'from the evil of what He has created,' },
          { t: 'وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ', s: 'Wa-min sharri ghāsiqin idhā waqab', e: 'and from the evil of the darkness as it falls,' },
          { t: 'وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ', s: 'Wa-min sharrin-naffāthāti fil-ʿuqad', e: 'and from the evil of those who blow on knots,' },
          { t: 'وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ', s: 'Wa-min sharri ḥāsidin idhā ḥasad', e: 'and from the evil of the envier when he envies.' }
        ],
        translation: 'A chapter of protection recited at dawn and dusk — shelter for the night, and for the fears within.'
      }
    ]
  },
  {
    id: 'judaism',
    name: 'Judaism',
    emoji: '✡️',
    glow: 'rgba(120, 150, 255, 0.28)',
    lightColor: '#7aa2ff',
    tagline: 'Covenant, memory, and the Oneness of God.',
    prayers: [
      {
        id: 'shema',
        title: 'The Shema',
        lang: 'he',
        langLabel: 'עברית · Hebrew',
        phrases: [
          { t: 'שְׁמַע יִשְׂרָאֵל יְהוָה אֱלֹהֵינוּ יְהוָה אֶחָד', s: 'Shema Yisrael: Adonai Eloheinu, Adonai Echad', e: 'Hear, O Israel: the Lord is our God, the Lord is One.' },
          { t: 'בָּרוּךְ שֵׁם כְּבוֹד מַלְכוּתוֹ לְעוֹלָם וָעֶד', s: 'Baruch shem kʼvod malchuto lʼolam vaʼed', e: 'Blessed is Godʼs glorious name for ever and ever.' },
          { t: "וְאָהַבְתָּ אֵת יְהוָה אֱלֹהֶיךָ בְּכָל־לְבָבְךָ וּבְכָל־נַפְשְׁךָ וּבְכָל־מְאֹדֶךָ", s: "Vʼahavta et Adonai Elohecha bʼchol lʼvavcha, uvʼchol nafshecha, uvʼchol mʼodecha", e: 'And you shall love the Lord your God with all your heart, and all your soul, and all your might.' }
        ],
        translation: 'The central affirmation of Jewish faith, recited every morning and evening.'
      },
      {
        id: 'modeh-ani',
        title: 'Modeh Ani',
        lang: 'he',
        langLabel: 'עברית · Hebrew · a morning prayer',
        loop: true,
        phrases: [
          { t: 'מוֹדֶה אֲנִי לְפָנֶיךָ מֶלֶךְ חַי וְקַיָּם', s: 'Modeh ani lʼfanecha, Melech chai vʼkayam', e: 'I give thanks before You, living and eternal King.' },
          { t: 'שֶׁהֶחֱזַרְתָּ בִּי נִשְׁמָתִי בְּחֶמְלָה', s: 'Shehechezarta bi nishmati bʼchemlah', e: 'For You have returned my soul to me with compassion.' },
          { t: 'רַבָּה אֱמוּנָתֶךָ', s: 'Rabbah emunatecha', e: 'Great is Your faithfulness.' }
        ],
        translation: 'The first words a Jew speaks on waking — gratitude before anything else.'
      },
      {
        id: 'oseh-shalom',
        title: 'Oseh Shalom',
        lang: 'he',
        langLabel: 'עברית · Hebrew',
        phrases: [
          { t: 'עֹשֶׂה שָׁלוֹם בִּמְרוֹמָיו', s: 'Oseh shalom bimromav', e: 'The One who makes peace in the heavens.' },
          { t: 'הוּא יַעֲשֶׂה שָׁלוֹם עָלֵינוּ', s: 'Hu yaʼaseh shalom aleinu', e: 'May He make peace for us,' },
          { t: 'וְעַל כָּל־יִשְׂרָאֵל', s: 'Vʼal kol Yisrael', e: 'and for all the world,' },
          { t: 'וְאִמְרוּ אָמֵן', s: 'Vʼimru amen', e: 'and let us say: Amen.' }
        ],
        translation: 'A closing prayer for peace — for us, for everyone, and for all who pray it.'
      },
      {
        id: 'shalom-aleichem',
        title: 'Shalom Aleichem',
        lang: 'he',
        langLabel: 'עברית · Hebrew',
        phrases: [
          { t: 'שָׁלוֹם עֲלֵיכֶם מַלְאֲכֵי הַשָּׁרֵת', s: 'Shalom aleichem malachei hasharet', e: 'Peace be upon you, ministering angels,' },
          { t: 'מַלְאֲכֵי עֶלְיוֹן', s: 'Malachei Elyon', e: 'angels of the Most High,' },
          { t: 'מִמֶּלֶךְ מַלְכֵי הַמְּלָכִים', s: 'Mimmelech hamelachim', e: 'from the King of kings,' },
          { t: 'הַקָּדוֹשׁ בָּרוּךְ הוּא', s: 'Hakadosh baruch hu', e: 'the Holy One, blessed be He.' },
          { t: 'בּוֹאֲכֶם לְשָׁלוֹם מַלְאֲכֵי הַשָּׁלוֹם', s: 'Boachem leshalom malachei hashalom', e: 'May your coming be for peace, angels of peace,' },
          { t: 'מַלְאֲכֵי עֶלְיוֹן', s: 'Malachei Elyon', e: 'angels of the Most High.' }
        ],
        translation: 'A traditional Sabbath greeting sung to the angels who accompany a person home — a prayer of welcome and peace.'
      },
      {
        id: 'ein-keloheinu',
        title: 'Ein Keloheinu',
        lang: 'he',
        langLabel: 'עברית · Hebrew',
        phrases: [
          { t: 'אֵין כֵּאלֹהֵינוּ, אֵין כַּאדוֹנֵנוּ', s: 'Ein kEloheinu, ein kAdoneinu', e: 'There is none like our God, none like our Lord.' },
          { t: 'אֵין כְּמַלְכֵּנוּ, אֵין כְּמוֹשִׁיעֵנוּ', s: 'Ein kMalkeinu, ein kMosheinu', e: 'There is none like our King, none like our Deliverer.' },
          { t: 'מִי כֵּאלֹהֵינוּ, מִי כַּאדוֹנֵנוּ', s: 'Mi kEloheinu, mi kAdoneinu', e: 'Who is like our God? Who is like our Lord?' },
          { t: 'נוֹדֶה לֵאלֹהֵינוּ, נוֹדֶה לַאדוֹנֵנוּ', s: 'Nodeh lEloheinu, nodeh lAdoneinu', e: 'We give thanks to our God, we give thanks to our Lord.' },
          { t: 'בָּרוּךְ אֱלֹהֵינוּ, בָּרוּךְ אֲדוֹנֵנוּ', s: 'Baruch Eloheinu, baruch Adoneinu', e: 'Blessed is our God, blessed is our Lord.' },
          { t: 'אַתָּה הוּא אֱלֹהֵינוּ', s: 'Atah hu Eloheinu', e: 'You are our God.' }
        ],
        translation: 'A joyful closing hymn of the liturgy — praise turned into a call-and-response of gratitude.'
      },
      {
        id: 'priestly-blessing',
        title: 'The Priestly Blessing',
        lang: 'he',
        langLabel: 'עברית · Hebrew',
        phrases: [
          { t: 'יְבָרֶכְךָ יְהוָה וְיִשְׁמְרֶךָ', s: 'Yevarechecha Adonai veyishmerecha', e: 'May the Lord bless you and keep you.' },
          { t: 'יָאֵר יְהוָה פָּנָיו אֵלֶיךָ וִיחֻנֶּךָּ', s: 'Yaʼer Adonai panav eilecha vichuneka', e: 'May the Lord make His face shine upon you and be gracious to you.' },
          { t: 'יִשָּׂא יְהוָה פָּנָיו אֵלֶיךָ וְיָשֵׂם לְךָ שָׁלוֹם', s: 'Yissa Adonai panav eilecha veyasem lecha shalom', e: 'May the Lord lift up His face to you and give you peace.' }
        ],
        translation: 'The ancient blessing God gave the priests, spoken over the people — among the oldest words of peace.'
      },
      {
        id: 'adon-olam',
        title: 'Adon Olam',
        lang: 'he',
        langLabel: 'עברית · Hebrew · repeated',
        loop: true,
        phrases: [
          { t: 'אֲדוֹן עוֹלָם אֲשֶׁר מָלַךְ', s: 'Adon olam asher malach', e: 'Lord of the world, who reigned' },
          { t: 'בְּטֶרֶם כָּל־יְצִיר נִבְרָא', s: 'Beterem kol yetsir nivra', e: 'before anything was created.' },
          { t: 'לְעֵת נַעֲשָׂה בְחֶפְצוֹ כֹּל', s: 'Leʼet naʼasah becheftzo kol', e: 'When all was made by His will,' },
          { t: 'אֲזַי מֶלֶךְ שְׁמוֹ נִקְרָא', s: 'Azai melech shemo nikra', e: 'then His name was called King.' },
          { t: 'בְּיָדוֹ אַפְקִיד רוּחִי', s: 'Beyado afkid ruchi', e: 'In His hand I entrust my spirit,' },
          { t: 'בְּעֵת אִישָׁן וְאָעִירָה', s: 'Beʼet ishan veʼarirah', e: 'when I sleep and when I wake.' }
        ],
        translation: 'The majestic closing hymn of the liturgy — God beyond time, and my soul held safe in His hand.'
      }
    ]
  },
  {
    id: 'hinduism',
    name: 'Hinduism',
    emoji: '🕉️',
    glow: 'rgba(255, 170, 110, 0.28)',
    lightColor: '#ff9e4f',
    tagline: 'Unity of all, the divine light within.',
    prayers: [
      {
        id: 'gayatri',
        title: 'Gāyatrī Mantra',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit',
        phrases: [
          { t: 'ॐ भूर्भुवः स्वः', s: 'Om bhūr bhuvaḥ svaḥ', e: 'Om. Earth, sky, heaven.' },
          { t: 'तत् सवितुर्वरेण्यं', s: 'Tat savitur vareṇyaṁ', e: 'We meditate on the excellent radiance' },
          { t: 'भर्गो देवस्य धीमहि', s: 'Bhargo devasya dhīmahi', e: 'of the divine Sun.' },
          { t: 'धियो यो नः प्रचोदयात्', s: 'Dhiyo yo naḥ pracodayāt', e: 'May it illumine and inspire our minds.' }
        ],
        translation: 'The most sacred mantra of the Vedas, calling on the light of wisdom to guide the mind.'
      },
      {
        id: 'om-namah-shivaya',
        title: 'Om Namah Shivāya',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit · repeated',
        loop: true,
        phrases: [
          { t: 'ॐ नमः शिवाय', s: 'Om namah śivāya', e: 'I bow to the auspicious one within all things.' },
          { t: 'ॐ नमः शिवाय', s: 'Om namah śivāya', e: 'I bow to the auspicious one within all things.' },
          { t: 'ॐ नमः शिवाय', s: 'Om namah śivāya', e: 'I bow to the auspicious one within all things.' }
        ],
        translation: 'The great five-syllable mantra of devotion, a heart of surrender to the inner Self.'
      },
      {
        id: 'mrityunjaya',
        title: 'Mahā Mṛtyuñjaya Mantra',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit',
        phrases: [
          { t: 'ॐ त्र्यम्बकं यजामहे सुगन्धिं पुष्टिवर्धनम्', s: 'Om tryambakaṁ yajāmahe sugandhiṁ puṣṭivardhanam', e: 'We worship the three-eyed One, fragrant and nourishing.' },
          { t: 'उर्वारुकमिव बन्धनान् मृत्योर्मुक्षीय मामृतात्', s: 'Uruvāru kamiva bandhanān mṛtyor mukṣīya māmṛtāt', e: 'Free us from the bonds of mortality, as a ripened gourd is freed from its stem, and lead us to immortality.' }
        ],
        translation: 'A healing mantra invoking renewal, courage, and the release from fear of death.'
      },
      {
        id: 'shanti-mantra',
        title: 'Shānti Mantra',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit',
        phrases: [
          { t: 'ॐ असतो मा सद्गमय', s: 'Om asato mā sad-gamaya', e: 'Om. Lead me from the unreal to the real.' },
          { t: 'तमसो मा ज्योतिर्गमय', s: 'Tamaso mā jyotir-gamaya', e: 'Lead me from darkness to light.' },
          { t: 'मृत्योर्मा अमृतं गमय', s: 'Mṛtyor mā amṛtaṁ gamaya', e: 'Lead me from death to immortality.' },
          { t: 'ॐ शान्तिः शान्तिः शान्तिः', s: 'Om śāntiḥ śāntiḥ śāntiḥ', e: 'Om. Peace, peace, peace.' }
        ],
        translation: 'The Upanishadic peace invocation — a journey from darkness toward light and stillness.'
      },
      {
        id: 'hare-krishna',
        title: 'The Mahā-Mantra',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit · repeated',
        loop: true,
        phrases: [
          { t: 'हरे कृष्ण हरे कृष्ण', s: 'Hare Kṛṣṇa, Hare Kṛṣṇa', e: 'Hare Krishna, Hare Krishna,' },
          { t: 'कृष्ण कृष्ण हरे हरे', s: 'Kṛṣṇa, Kṛṣṇa, Hare, Hare', e: 'Krishna, Krishna, Hare, Hare,' },
          { t: 'हरे राम हरे राम', s: 'Hare Rāma, Hare Rāma', e: 'Hare Rama, Hare Rama,' },
          { t: 'राम राम हरे हरे', s: 'Rāma, Rāma, Hare, Hare', e: 'Rama, Rama, Hare, Hare.' }
        ],
        translation: 'The great mantra of the heart from the Vaishnava tradition — the divine names sung until the mind grows still.'
      },
      {
        id: 'vasudevaya',
        title: 'Om Namo Bhagavate Vāsudevāya',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit · repeated',
        loop: true,
        phrases: [
          { t: 'ॐ नमो भगवते वासुदेवाय', s: 'Om namo bhagavate vāsudevāya', e: 'I bow to the Divine who dwells in all things.' },
          { t: 'ॐ नमो भगवते वासुदेवाय', s: 'Om namo bhagavate vāsudevāya', e: 'I bow to the Divine who dwells in all things.' },
          { t: 'ॐ नमो भगवते वासुदेवाय', s: 'Om namo bhagavate vāsudevāya', e: 'I bow to the Divine who dwells in all things.' }
        ],
        translation: 'A twelve-syllable mantra of surrender to the Lord within the heart, chanted as devotion without end.'
      },
      {
        id: 'ram-nam',
        title: 'Śrī Rām Jai Rām',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit · repeated',
        loop: true,
        phrases: [
          { t: 'श्री राम जय राम जय जय राम', s: 'Śrī Rām jay Rām jay jay Rām', e: 'Glory to Rama — the divine light within all things.' },
          { t: 'श्री राम जय राम जय जय राम', s: 'Śrī Rām jay Rām jay jay Rām', e: 'Glory to Rama — the divine light within all things.' },
          { t: 'श्री राम जय राम जय जय राम', s: 'Śrī Rām jay Rām jay jay Rām', e: 'Glory to Rama — the divine light within all things.' }
        ],
        translation: 'The simple chanting of the divine Name — devotion made of nothing but love.'
      }
    ]
  },
  {
    id: 'buddhism',
    name: 'Buddhism',
    emoji: '☸️',
    glow: 'rgba(255, 210, 120, 0.26)',
    lightColor: '#ffd166',
    tagline: 'Compassion, stillness, and the middle way.',
    prayers: [
      {
        id: 'mani',
        title: 'Om Maṇi Padme Hūṃ',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit · repeated',
        loop: true,
        phrases: [
          { t: 'ॐ मणि पद्मे हूँ', s: 'Om maṇi padme hūṃ', e: 'The jewel in the lotus.' },
          { t: 'ॐ मणि पद्मे हूँ', s: 'Om maṇi padme hūṃ', e: 'The jewel in the lotus.' },
          { t: 'ॐ मणि पद्मे हूँ', s: 'Om maṇi padme hūṃ', e: 'The jewel in the lotus.' },
          { t: 'ॐ मणि पद्मे हूँ', s: 'Om maṇi padme hūṃ', e: 'The jewel in the lotus.' }
        ],
        translation: 'The beloved mantra of Tibetan Buddhism — compassion taking shape as sound.'
      },
      {
        id: 'daimoku',
        title: 'Nam Myōhō Renge Kyō',
        lang: 'ja',
        langLabel: '日本語 · Japanese · repeated',
        loop: true,
        phrases: [
          { t: '南無妙法蓮華經', s: 'Nam Myōhō Renge Kyō', e: 'Devotion to the Mystic Law of cause and effect.' },
          { t: '南無妙法蓮華經', s: 'Nam Myōhō Renge Kyō', e: 'Devotion to the Mystic Law of cause and effect.' },
          { t: '南無妙法蓮華經', s: 'Nam Myōhō Renge Kyō', e: 'Devotion to the Mystic Law of cause and effect.' }
        ],
        translation: 'The Daimoku of Nichiren Buddhism, chanted to awaken the Buddha-nature within.'
      },
      {
        id: 'refuges',
        title: 'The Three Refuges',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'I take refuge in the Buddha,' },
          { t: 'the one who has awakened.' },
          { t: 'I take refuge in the Dharma,' },
          { t: 'the path of the teaching.' },
          { t: 'I take refuge in the Sangha,' },
          { t: 'the community of all beings walking the way.' }
        ],
        translation: 'The opening vow of Buddhist practice — returning home to awakening, truth, and companionship.'
      },
      {
        id: 'om-tare',
        title: 'Om Tāre Tuttāre Ture Svāhā',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit · repeated',
        loop: true,
        phrases: [
          { t: 'ॐ तारे तुत्तारे तुरे स्वाहा', s: 'Om tāre tuttāre ture svāhā', e: 'Homage to Tārā, swift liberator.' },
          { t: 'ॐ तारे तुत्तारे तुरे स्वाहा', s: 'Om tāre tuttāre ture svāhā', e: 'Homage to Tārā, swift liberator.' },
          { t: 'ॐ तारे तुत्तारे तुरे स्वाहा', s: 'Om tāre tuttāre ture svāhā', e: 'Homage to Tārā, swift liberator.' }
        ],
        translation: 'The mantra of Green Tārā, the swift mother of compassion, called on for protection and courage.'
      },
      {
        id: 'metta',
        title: 'The Words of Loving-Kindness',
        lang: 'pi',
        langLabel: 'Pāli · repeated',
        loop: true,
        phrases: [
          { t: 'Sabbe sattā bhavantu sukhitattā', s: 'Sabbe sattā bhavantu sukhitattā', e: 'May all beings be happy and at ease.' },
          { t: 'Sabbe sattā arogyā hontu', s: 'Sabbe sattā arogyā hontu', e: 'May all beings be healthy and whole.' },
          { t: 'Sabbe sattā sukhitā hontu', s: 'Sabbe sattā sukhitā hontu', e: 'May all beings be truly happy.' },
          { t: 'Sabbe sattā khemā hontu', s: 'Sabbe sattā khemā hontu', e: 'May all beings be safe from harm.' },
          { t: 'Sabbe sattā bhadram passantu', s: 'Sabbe sattā bhadram passantu', e: 'May all beings look upon what is good.' }
        ],
        translation: 'The Buddhaʼs teaching on loving-kindness — a wish repeated for every being, without exception.'
      },
      {
        id: 'sarana',
        title: 'The Triple Refuge',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit · repeated',
        loop: true,
        phrases: [
          { t: 'बुद्धं शरणं गच्छामि', s: 'Buddhaṁ śaraṇaṁ gacchāmi', e: 'I go for refuge to the Buddha.' },
          { t: 'धर्मं शरणं गच्छामि', s: 'Dhammaṁ śaraṇaṁ gacchāmi', e: 'I go for refuge to the Dharma.' },
          { t: 'संघं शरणं गच्छामि', s: 'Saṅghaṁ śaraṇaṁ gacchāmi', e: 'I go for refuge to the Sangha.' }
        ],
        translation: 'The ancient triple refuge of the Buddha — returning home to awakening, truth, and fellowship.'
      },
      {
        id: 'nianfo',
        title: 'Nāmó Āmítuófó',
        lang: 'zh',
        langLabel: '中文 · Chinese · repeated',
        loop: true,
        phrases: [
          { t: '南無阿彌陀佛', s: 'Nāmó Āmítuófó', e: 'Homage to Amitābha, the Buddha of boundless light.' },
          { t: '南無阿彌陀佛', s: 'Nāmó Āmítuófó', e: 'Homage to Amitābha, the Buddha of boundless light.' },
          { t: '南無阿彌陀佛', s: 'Nāmó Āmítuófó', e: 'Homage to Amitābha, the Buddha of boundless light.' }
        ],
        translation: 'The nianfo of Pure Land Buddhism, recited in gratitude for boundless light and compassion.'
      }
    ]
  },
  {
    id: 'sikhism',
    name: 'Sikhism',
    emoji: '💠',
    glow: 'rgba(120, 220, 220, 0.26)',
    lightColor: '#59d8d8',
    tagline: 'One Creator, truthful living, service to all.',
    prayers: [
      {
        id: 'mool-mantar',
        title: 'Mūl Mantar',
        lang: 'pa',
        langLabel: 'ਪੰਜਾਬੀ · Gurmukhi',
        phrases: [
          { t: 'ੴ ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ', s: 'Ik Onkar, Sat Nām, Kartā Purakh, Nirbhaʼu, Nirvair', e: 'One Universal Creator; truth by name; doer of all; without fear; without enmity.' },
          { t: 'ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ ॥', s: 'Akāl Mūrat, Ajūnī, Saibhaṅg, Gurprasād', e: 'Timeless Being; unborn; self-existent; realized through the Guruʼs grace.' }
        ],
        translation: 'The opening words of the Guru Granth Sahib, the root statement of Sikh faith.'
      },
      {
        id: 'waheguru',
        title: 'Waheguru Simran',
        lang: 'pa',
        langLabel: 'ਪੰਜਾਬੀ · Gurmukhi · repeated',
        loop: true,
        phrases: [
          { t: 'ਵਾਹਿਗੁਰੂ', s: 'Waheguru', e: 'Wonderful Lord — the divine light beyond all knowing.' },
          { t: 'ਵਾਹਿਗੁਰੂ', s: 'Waheguru', e: 'Wonderful Lord — the divine light beyond all knowing.' },
          { t: 'ਵਾਹਿਗੁਰੂ', s: 'Waheguru', e: 'Wonderful Lord — the divine light beyond all knowing.' },
          { t: 'ਵਾਹਿਗੁਰੂ', s: 'Waheguru', e: 'Wonderful Lord — the divine light beyond all knowing.' }
        ],
        translation: 'The meditative repetition of the Name — remembrance of the One through every breath.'
      },
      {
        id: 'anand',
        title: 'Tera Kiya — From Anand Sahib',
        lang: 'pa',
        langLabel: 'ਪੰਜਾਬੀ · Gurmukhi',
        phrases: [
          { t: 'ਤੇਰਾ ਕੀਤਾ ਜਾਤੋ ਨਾਹੀ', s: 'Tērā kītā jātō nāhī', e: 'The value of what You have given, I cannot know.' },
          { t: 'ਮਨੋ ਗੁਨ ਨਵ ਨਿਧ ਆਵੈ', s: 'Mino gun nav nidh āvai', e: 'No treasure could ever repay it.' },
          { t: 'ਤੇਰਾ ਮੀਤਾ ਸਭੁ ਕੋ', s: 'Tērā mītā sabhu ko', e: 'Everyone is Your friend.' },
          { t: 'ਸਭਨਾ ਦਾ ਸਾਹਿਬੁ ਸਭੁ ਕੋ', s: 'Sabhanā dā sāhib sabhu ko', e: 'And You are the Master of all.' }
        ],
        translation: 'A hymn of humble gratitude — for gifts we can never repay, given by a love without limit.'
      },
      {
        id: 'gur-mantar',
        title: 'Gur Mantar',
        lang: 'pa',
        langLabel: 'ਪੰਜਾਬੀ · Gurmukhi · repeated',
        loop: true,
        phrases: [
          { t: 'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ', s: 'Vāhegurū jī kā Khālsā', e: 'The Khalsa belongs to the Wonderful Lord,' },
          { t: 'ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਹਿ', s: 'Vāhegurū jī kī Fateh', e: 'and victory belongs to the Wonderful Lord.' }
        ],
        translation: 'The Sikh greeting of the Khalsa — remembrance and victory belonging to the One, repeated with every breath.'
      },
      {
        id: 'deh-shiva',
        title: 'Deh Shivā Bar Mohe',
        lang: 'pa',
        langLabel: 'ਪੰਜਾਬੀ · Gurmukhi',
        phrases: [
          { t: 'ਦੇਹ ਸਿਵਾ ਬਰ ਮੋਹਿ ਇਹੈ ਸ਼ੁਭ ਕਰਮਨ ਤੇ ਕਬਹੂੰ ਨ ਟਰੋਂ', s: 'Deh śivā bar mohi ehai, śubh karman te kabahū̃ na ṭarō̃', e: 'Grant me this boon, O Lord — that I never turn from good deeds.' },
          { t: 'ਨ ਡਰੋਂ ਅਰਿ ਸੋ ਜਬ ਜਾਇ ਤਰੋਂ', s: 'Na ḍarō̃ ari so jab jāi tarō̃', e: 'That I never fear the enemy when I go into battle.' },
          { t: 'ਨਿਸਚੈ ਕਰਿ ਅਪਨੀ ਜੀਤ ਕਰੋਂ', s: 'Niścai kari apnī jīt karō̃', e: 'And with firm resolve, I claim the victory.' },
          { t: 'ਆਰਜ ਕੀਰਤਿ ਲੈ ਮੈਂ ਗਹਾ ਸੁਧਰਮ ਕਹਾ ਹੈ ਭਜਨ ਅਰ ਖਟਾ', s: 'Āraj kīrati lai maiṁ gahā, sudharam kahā hai bhajan ar khaṭā', e: 'Let me live long to sing Your praises, and earn my keep through honest work.' }
        ],
        translation: 'A soldier-prayer of the Khalsa — courage, righteousness, and remembrance of the Name.'
      },
      {
        id: 'chardi-kala',
        title: 'Chaṛhdī Kalā',
        lang: 'pa',
        langLabel: 'ਪੰਜਾਬੀ · Gurmukhi · repeated',
        loop: true,
        phrases: [
          { t: 'ਨਾਨਕ ਨਾਮ ਚੜ੍ਹਦੀ ਕਲਾ', s: 'Nānak nām chaṛhdī kalā', e: 'By the Name of Nanak, may we ever rise higher.' },
          { t: 'ਤੇਰੇ ਭਾਣੇ ਸਰਬੱਤ ਦਾ ਭਲਾ', s: 'Tere bhāṇe sarbatt dā bhalā', e: 'By Your will, may the good of all be done.' }
        ],
        translation: 'The Sikh declaration of hope — an ever-rising spirit, and the good of all under Godʼs will.'
      },
      {
        id: 'sat-sri-akal',
        title: 'Sat Srī Akāl',
        lang: 'pa',
        langLabel: 'ਪੰਜਾਬੀ · Gurmukhi · repeated',
        loop: true,
        phrases: [
          { t: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', s: 'Sat Srī Akāl', e: 'Truth is the Eternal One.' },
          { t: 'ਅਕਾਲ ਸਹਾਇ', s: 'Akāl sahāi', e: 'May the Eternal One be your help.' },
          { t: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', s: 'Sat Srī Akāl', e: 'Truth is the Eternal One.' }
        ],
        translation: 'The greeting and battle-cry of the Khalsa — courage born of the Eternal Truth.'
      }
    ]
  },
  {
    id: 'taoism',
    name: 'Taoism',
    emoji: '☯️',
    glow: 'rgba(200, 180, 255, 0.24)',
    lightColor: '#b09dff',
    tagline: 'Harmony, wu wei, and the flow of the Dao.',
    prayers: [
      {
        id: 'qingjing',
        title: 'The Classic of Purity and Stillness',
        lang: 'zh',
        langLabel: '中文 · Chinese',
        phrases: [
          { t: '大道無形，生育天地；', s: 'Dàodào wúxíng, shēngyù tiāndì;', e: 'The Great Dao has no form, yet gives birth to heaven and earth.' },
          { t: '大道無情，運行日月；', s: 'Dàodào wúqíng, yùnxíng rìyuè;', e: 'The Great Dao has no feelings, yet moves the sun and moon.' },
          { t: '大道無名，長養萬物。', s: 'Dàodào wúmíng, zhǎngyǎng wànwù.', e: 'The Great Dao has no name, yet nourishes all things.' },
          { t: '人能常清靜，天地悉皆歸。', s: 'Rén néng cháng qīngjìng, tiāndì xī jiē guī.', e: 'If a person remains always clear and still, all of heaven and earth returns to them.' }
        ],
        translation: 'A core Taoist text on emptying the mind to return to the natural, spontaneous flow of the Dao.'
      },
      {
        id: 'dao-de-jing-opening',
        title: 'The Dao That Can Be Told',
        lang: 'zh',
        langLabel: '中文 · Chinese',
        phrases: [
          { t: '道可道，非常道；', s: 'Dào kě dào, fēi cháng dào;', e: 'The Dao that can be told is not the eternal Dao.' },
          { t: '名可名，非常名。', s: 'Míng kě míng, fēi cháng míng.', e: 'The name that can be named is not the eternal name.' },
          { t: '無名，天地之始；', s: 'Wúmíng, tiāndì zhī shǐ;', e: 'The nameless is the beginning of heaven and earth.' },
          { t: '有名，萬物之母。', s: 'Yǒumíng, wànwù zhī mǔ.', e: 'The named is the mother of the ten thousand things.' }
        ],
        translation: 'The opening of the Dao De Jing — the mystery beyond words from which all things arise.'
      },
      {
        id: 'wu-wei',
        title: 'A Prayer of Wu Wei',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Let me act without forcing,' },
          { t: 'and flow like water around every stone.' },
          { t: 'Let me yield to the season of this day,' },
          { t: 'and trust the silent work of not-doing.' },
          { t: 'In letting go, may I be filled;' },
          { t: 'in stillness, may I be moved.' }
        ],
        translation: 'A meditation on wu wei — effortless action in harmony with the Dao.'
      },
      {
        id: 'ganying',
        title: 'From the Treatise on Response and Retribution',
        lang: 'zh',
        langLabel: '中文 · Chinese',
        phrases: [
          { t: '禍福無門，惟人自召；', s: 'Huò fú wú mén, wéi rén zì zhào;', e: 'Fortune and misfortune have no door; only a person summons them.' },
          { t: '善惡之報，如影隨形。', s: 'Shàn è zhī bào, rú yǐng suí xíng.', e: 'The reward of good and evil follows like a shadow.' },
          { t: '是道則進，非道則退。', s: 'Shì dào zé jìn, fēi dào zé tuì.', e: 'Walk the way of goodness; step back from what is not the way.' }
        ],
        translation: 'A famous Taoist teaching on moral living — the quiet law by which good deeds find their way home.'
      },
      {
        id: 'three-treasures',
        title: 'The Three Treasures',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'I hold three treasures close and guard them well:' },
          { t: 'compassion, frugality, and humility.' },
          { t: 'For the compassionate are truly brave,' },
          { t: 'the frugal are truly generous,' },
          { t: 'and those who do not lead are able to lead all.' },
          { t: 'Dare to be gentle. That is to accord with heaven.' }
        ],
        translation: 'The three treasures of the Dao De Jing — the quiet strengths that keep a life in harmony.'
      }
    ]
  },
  {
    id: 'shinto',
    name: 'Shinto',
    emoji: '⛩️',
    glow: 'rgba(255, 150, 120, 0.24)',
    lightColor: '#ff8f7a',
    tagline: 'Kami, purity, and gratitude before nature.',
    prayers: [
      {
        id: 'oharai',
        title: 'Ōharae — The Great Purification',
        lang: 'ja',
        langLabel: '日本語 · Japanese',
        phrases: [
          { t: '祓へ給へ、清め給へ', s: 'Harae tamae, kiyome tamae', e: 'Purify us, cleanse us.' },
          { t: '高天原に神留り坐す', s: 'Takama-ga-hara ni kamuzumari-masu', e: 'The kami who abide in the High Plain of Heaven,' },
          { t: '諸々の禍事・罪・穢れを', s: 'Moromoro no magagoto, tsumi, kegare o', e: 'take away every misfortune, fault, and defilement,' },
          { t: '祓へ給ひ清め給ふことを', s: 'Harae-tamai kiyome-tamau koto o', e: 'and purify them away.' }
        ],
        translation: 'The ancient rite of purification spoken at shrines — an offering of cleansing before the kami.'
      },
      {
        id: 'amaterasu',
        title: 'Before Amaterasu',
        lang: 'ja',
        langLabel: '日本語 · Japanese',
        phrases: [
          { t: '天照大御神', s: 'Amaterasu Ōmikami', e: 'Great Shining One of Heaven,' },
          { t: '此の朝の光をありがとう', s: 'Kono asa no hikari o arigatō', e: 'thank you for the light of this morning.' },
          { t: '心を静かに清め', s: 'Kokoro o shizuka ni kiyome', e: 'quiet my heart and make it pure,' },
          { t: '今日を誠実に生きん。', s: 'Kyō o seijitsu ni ikin.', e: 'that I may live this day in honesty and truth.' }
        ],
        translation: 'A simple morning offering of gratitude to the Sun Goddess — the source of light and life.'
      },
      {
        id: 'misono',
        title: 'A Norito of the Heart',
        lang: 'ja',
        langLabel: '日本語 · Japanese',
        phrases: [
          { t: '清き明き直きこころにて', s: 'Kiyoki aki tadaki kokoro nite', e: 'With a heart pure, open, and upright,' },
          { t: '言挙げせぬ道を行き', s: 'Kotoage senu michi o iki', e: 'I walk the path of quiet sincerity,' },
          { t: '神の恵みに感謝します。', s: 'Kami no megumi ni kansha shimasu.', e: 'and give thanks for the blessings of the kami.' }
        ],
        translation: 'A short norito of sincerity — a clean heart offered before the divine presence in all things.'
      },
      {
        id: 'kami-presence',
        title: 'In the Presence of the Kami',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'The divine dwells in the mountain, the river, and the tree.' },
          { t: 'In the breath of morning and the hush of the shrine,' },
          { t: 'I bow in gratitude before what is greater than me.' },
          { t: 'May my hands do no harm,' },
          { t: 'and my steps disturb nothing.' },
          { t: 'This day is a gift. I receive it with both hands.' }
        ],
        translation: 'A reflection on the Shinto sense of the sacred — the kami present in all of nature.'
      },
      {
        id: 'kannagara',
        title: 'Kannagara — With the Kami',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Living in accord with the kami,' },
          { t: 'I walk gently through this day.' },
          { t: 'Every river, every grove, every ordinary moment' },
          { t: 'holds a presence worthy of reverence.' },
          { t: 'May my life be a quiet bow' },
          { t: 'to the sacred woven through all things.' }
        ],
        translation: 'A reflection on kannagara — the Shinto way of living in harmony with the divine that pervades the world.'
      }
    ]
  },
  {
    id: 'jainism',
    name: 'Jainism',
    emoji: '🪷',
    glow: 'rgba(255, 210, 200, 0.24)',
    lightColor: '#ff9fbf',
    tagline: 'Ahimsa, reverence for all life, and inner freedom.',
    prayers: [
      {
        id: 'navakar',
        title: 'The Navakār Mantra',
        lang: 'pra',
        langLabel: 'प्राकृत · Prakrit',
        phrases: [
          { t: 'णमो अरिहंताणं', s: 'Namo arihantāṇaṁ', e: 'I bow to the perfected ones.' },
          { t: 'णमो सिद्धाणं', s: 'Namo siddhāṇaṁ', e: 'I bow to the liberated souls.' },
          { t: 'णमो आइरियाणं', s: 'Namo āiriyāṇaṁ', e: 'I bow to the spiritual teachers.' },
          { t: 'णमो उवज्झायाणं', s: 'Namo uvajjhāyāṇaṁ', e: 'I bow to the preceptors.' },
          { t: 'णमो लोए सव्व साहूणं', s: 'Namo loe savva sāhūṇaṁ', e: 'I bow to all the saints in the world.' }
        ],
        translation: 'The supreme Jain mantra of veneration — bowing to those who have freed themselves, and to all seekers on the path.'
      },
      {
        id: 'ahimsa',
        title: 'Ahimsā Paramo Dharmaḥ',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit',
        phrases: [
          { t: 'अहिंसा परमो धर्मः', s: 'Ahimsā paramo dharmaḥ', e: 'Non-violence is the supreme religion.' },
          { t: 'अहिंसा परमो तपः', s: 'Ahimsā paramo tapaḥ', e: 'Non-violence is the highest penance.' },
          { t: 'अहिंसा परमं सत्यं', s: 'Ahimsā paramaṁ satyam', e: 'Non-violence is the highest truth,' },
          { t: 'अहिंसा परमं ज्ञानम्', s: 'Ahimsā paramaṁ jñānam', e: 'and non-violence the highest knowledge.' }
        ],
        translation: 'The great Jain declaration — harmlessness toward every living being as the root of all virtue.'
      },
      {
        id: 'khamavani',
        title: 'Khamāvaṇī — The Forgiveness Prayer',
        lang: 'pra',
        langLabel: 'प्राकृत · Prakrit',
        phrases: [
          { t: 'खमेमि सव्वे जीवा', s: 'Khamemi savve jīvā', e: 'I forgive all living beings.' },
          { t: 'सव्वे जीवा खमंतु मे', s: 'Savve jīvā khamantu me', e: 'May all living beings forgive me.' },
          { t: 'मित्ति मे सव्व भूएसु', s: 'Mitti me savva bhūesu', e: 'I am a friend to all beings.' },
          { t: 'वेरं मझं न केणइ', s: 'Veraṁ majjhaṁ na keṇai', e: 'I hold enmity with no one.' }
        ],
        translation: 'The Jain prayer of reconciliation, spoken at the close of the holy days — forgiveness given and received.'
      },
      {
        id: 'mahavira-vow',
        title: 'The Vow of Mahāvīra',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'May all beings be at ease.' },
          { t: 'May no creature be harmed by thought, word, or deed of mine.' },
          { t: 'Let me speak the truth, and harm none by it.' },
          { t: 'Let me be content with little, and generous with all.' },
          { t: 'In this vast web of life, I take my place gently.' }
        ],
        translation: 'A reflection on the five great vows of Mahavira — non-violence, truth, non-stealing, chastity, and non-attachment.'
      },
      {
        id: 'pratikraman',
        title: 'Pratikramaṇa — Returning to the Path',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'I bow to the way of ahimsa, and turn back from harm.' },
          { t: 'For any hurt I have caused by thought, word, or deed,' },
          { t: 'I ask forgiveness of all living beings.' },
          { t: 'And I forgive all who have wronged me.' },
          { t: 'Let me begin again, gently, with every being.' }
        ],
        translation: 'A reflection on pratikramana — the Jain practice of confession and turning back to the path of non-violence.'
      }
    ]
  },
  {
    id: 'bahai',
    name: 'Baháʼí Faith',
    emoji: '✴️',
    glow: 'rgba(220, 180, 120, 0.24)',
    lightColor: '#ffc26b',
    tagline: 'Oneness of God, oneness of religion, oneness of humankind.',
    prayers: [
      {
        id: 'obligatory-short',
        title: 'The Short Obligatory Prayer',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'I bear witness, O my God, that Thou hast created me to know Thee and to worship Thee.' },
          { t: 'I testify, at this moment, to my powerlessness and to Thy might,' },
          { t: 'to my poverty and to Thy wealth.' },
          { t: 'There is none other God but Thee, the Help in Peril, the Self-Subsisting.' }
        ],
        translation: 'The daily obligatory prayer of the Baháʼí Faith — a witness of trust and surrender before God.'
      },
      {
        id: 'son-of-spirit',
        title: 'O Son of Spirit',
        lang: 'en',
        langLabel: 'English · from the Hidden Words',
        phrases: [
          { t: 'O Son of Spirit! My first counsel is this: possess a pure, kindly, and radiant heart,' },
          { t: 'that thine may be a sovereignty ancient, imperishable, and everlasting.' },
          { t: 'The best beloved of all things in My sight is Justice;' },
          { t: 'turn not away therefrom if thou desirest Me, and neglect it not' },
          { t: 'that I may confide in thee.' }
        ],
        translation: 'A passage from Baháʼuʼlláhʼs Hidden Words — the counsels that begin the spiritual life.'
      },
      {
        id: 'unity',
        title: 'O Thou Kind Lord',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'O Thou kind Lord! Unite all.' },
          { t: 'Let the religions agree, and make us as brothers and sisters,' },
          { t: 'that we may treat one another as we love ourselves.' },
          { t: 'We are all the fruits of one tree, and the leaves of one branch.' }
        ],
        translation: 'A prayer for unity from the Baháʼí writings — one humanity, one tree.'
      },
      {
        id: 'remover-difficulties',
        title: 'Remover of Difficulties',
        lang: 'en',
        langLabel: 'English · repeated',
        loop: true,
        phrases: [
          { t: 'Is there any Remover of difficulties save God?' },
          { t: 'Say: Praised be God! He is God! All are His servants, and all abide by His bidding!' }
        ],
        translation: 'A short, beloved prayer of Baháʼuʼlláh recited in times of hardship and need.'
      },
      {
        id: 'healing',
        title: 'A Prayer for Healing',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Thy name is my healing, O my God, and remembrance of Thee is my remedy.' },
          { t: 'Nearness to Thee is my hope, and love for Thee is my companion.' },
          { t: 'Thy mercy to me is my healing and my succor in both this world and the world to come.' }
        ],
        translation: 'A prayer of Baháʼuʼlláh for healing and nearness to God, offered in times of illness and need.'
      }
    ]
  },
  {
    id: 'earthway',
    name: 'Earthway · Indigenous',
    emoji: '🌿',
    glow: 'rgba(120, 200, 140, 0.24)',
    lightColor: '#7fd488',
    tagline: 'All my relations — gratitude to the living world.',
    prayers: [
      {
        id: 'mitakuye-oyasin',
        title: 'Mitákuye Oyásʼiŋ — All My Relations',
        lang: 'lkt',
        langLabel: 'Lakȟótiyapi · Lakota · repeated',
        loop: true,
        phrases: [
          { t: 'Mitákuye Oyásʼiŋ', s: 'Mitákuye Oyásʼiŋ', e: 'All my relations — we are all connected.' },
          { t: 'Mitákuye Oyásʼiŋ', s: 'Mitákuye Oyásʼiŋ', e: 'All my relations — we are all connected.' },
          { t: 'Mitákuye Oyásʼiŋ', s: 'Mitákuye Oyásʼiŋ', e: 'All my relations — we are all connected.' }
        ],
        translation: 'A Lakota prayer of kinship — "all my relations" — repeated as a meditation on our connection to every living thing.'
      },
      {
        id: 'hooponopono',
        title: 'Hoʼoponopono',
        lang: 'haw',
        langLabel: 'ʻŌlelo Hawaiʻi · Hawaiian',
        phrases: [
          { t: 'E kala mai iaʻu', s: 'E kala mai iaʻu', e: 'Please forgive me.' },
          { t: 'Ua kala aku au iā ʻoe', s: 'Ua kala aku au iā ʻoe', e: 'I forgive you.' },
          { t: 'Mahalo iā ʻoe', s: 'Mahalo iā ʻoe', e: 'Thank you.' },
          { t: 'Aloha wau iā ʻoe', s: 'Aloha wau iā ʻoe', e: 'I love you.' }
        ],
        translation: 'The Hawaiian practice of reconciliation and healing — forgiveness, gratitude, and love offered to set things right.'
      },
      {
        id: 'seven-directions',
        title: 'A Prayer to the Seven Directions',
        lang: 'en',
        langLabel: 'English · shared with gratitude',
        phrases: [
          { t: 'To the East, where the sun rises, we give thanks for new beginnings.' },
          { t: 'To the South, where warmth grows, we give thanks for abundance.' },
          { t: 'To the West, where the day rests, we give thanks for what is fulfilled.' },
          { t: 'To the North, where wisdom lives, we give thanks for endurance.' },
          { t: 'To the sky above and the earth below,' },
          { t: 'and to the center where we stand — all my relations. Aho.' }
        ],
        translation: 'A widely shared honoring of the directions — a prayer of gratitude to the world that holds us.'
      },
      {
        id: 'thanksgiving-land',
        title: 'Thanksgiving for the Land',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'For the soil beneath our feet, we give thanks.' },
          { t: 'For the water that gives life, we give thanks.' },
          { t: 'For the corn, the fish, and the fruit of the land, we give thanks.' },
          { t: 'May we remember that we borrow this Earth from our children.' },
          { t: 'With every harvest, let us give back more than we take.' }
        ],
        translation: 'A prayer of thanksgiving for the living land — gratitude that keeps us humble and generous.'
      }
    ]
  },
  {
    id: 'zoroastrianism',
    name: 'Zoroastrianism',
    emoji: '🕯️',
    glow: 'rgba(255, 190, 90, 0.26)',
    lightColor: '#ffc46b',
    tagline: 'Good thoughts, good words, good deeds — the flame of truth.',
    prayers: [
      {
        id: 'ashem-vohu',
        title: 'Ashem Vohu',
        lang: 'ae',
        langLabel: 'Avestan · repeated',
        loop: true,
        phrases: [
          { t: 'Ashəm vohū vahishtəm astī, ushtā astī, ushtā ahmāi, hyat ashāi vahishtāi ashəm.', s: 'Ashəm vohū vahishtəm astī, ushtā astī, ushtā ahmāi, hyat ashāi vahishtāi ashəm.', e: 'Righteousness is the best good, and it is happiness — happiness to the one who is righteous for the sake of the highest righteousness.' },
          { t: 'Ashəm vohū vahishtəm astī, ushtā astī, ushtā ahmāi, hyat ashāi vahishtāi ashəm.', s: 'Ashəm vohū vahishtəm astī, ushtā astī, ushtā ahmāi, hyat ashāi vahishtāi ashəm.', e: 'Righteousness is the best good, and it is happiness — happiness to the one who is righteous for the sake of the highest righteousness.' },
          { t: 'Ashəm vohū vahishtəm astī, ushtā astī, ushtā ahmāi, hyat ashāi vahishtāi ashəm.', s: 'Ashəm vohū vahishtəm astī, ushtā astī, ushtā ahmāi, hyat ashāi vahishtāi ashəm.', e: 'Righteousness is the best good, and it is happiness — happiness to the one who is righteous for the sake of the highest righteousness.' }
        ],
        translation: 'One of the most sacred prayers of Zoroastrianism — the vow of a life aligned with truth and righteousness.'
      },
      {
        id: 'humata',
        title: 'Humata, Hukhta, Huvarshta',
        lang: 'ae',
        langLabel: 'Avestan · repeated',
        loop: true,
        phrases: [
          { t: 'Humata, hukhta, huvarshta.', s: 'Humata, hukhta, huvarshta.', e: 'Good thoughts, good words, good deeds.' },
          { t: 'Humata, hukhta, huvarshta.', s: 'Humata, hukhta, huvarshta.', e: 'Good thoughts, good words, good deeds.' },
          { t: 'Humata, hukhta, huvarshta.', s: 'Humata, hukhta, huvarshta.', e: 'Good thoughts, good words, good deeds.' }
        ],
        translation: 'The threefold path at the heart of Zoroastrian faith — thought, speech, and action kept pure.'
      },
      {
        id: 'ahuna-vairya',
        title: 'Ahuna Vairya',
        lang: 'ae',
        langLabel: 'Avestan',
        phrases: [
          { t: 'Yatā ahū vairyō, aθā ratuš ašāt̰cīt̰ hacā', s: 'Yatā ahū vairyō, athā ratush ashatchit hachā', e: 'As the heavenly Lord is to be chosen, so is the earthly judge, in accord with truth.' },
          { t: 'vaŋhə̄uš dazdā manaŋhō, šyaoθananąm aŋhə̄uš mazdāi', s: 'Vanghēush dazdā mananghō, shyaothananām anghēush mazdāi', e: 'By the good mind, may deeds be done for Mazda.' },
          { t: 'xšaθrəmcā ahurāi, ā yim drigubyō dadat̰ vāstārəm.', s: 'Khshathremchā ahurāi, ā yim drigubyō dadat vāstārem.', e: 'And the Kingdom of Ahura — for those who give the poor a shepherd.' }
        ],
        translation: 'The Ahuna Vairya, the most sacred formula of the Zoroastrian faith — the seal of truth and care for the vulnerable.'
      },
      {
        id: 'fire-blessing',
        title: 'Before the Sacred Fire',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'The fire that burns before me is the light of truth.' },
          { t: 'Let my thoughts be good, my words true, and my deeds kind.' },
          { t: 'Let me warm the cold, lighten the dark, and strengthen the weak.' },
          { t: 'This day, I will tend the flame within me,' },
          { t: 'and by it, be a little light to the world.' }
        ],
        translation: 'A reflection on the sacred fire — a reminder that each person carries a flame of truth to tend and share.'
      }
    ]
  },
  {
    id: 'nonreligious',
    name: 'Agnostic · Atheist',
    emoji: '🌌',
    glow: 'rgba(150, 170, 255, 0.24)',
    lightColor: '#a9b0ff',
    tagline: 'Wonder, kindness, and the cosmos we share.',
    prayers: [
      {
        id: 'gratitude',
        title: 'A Moment of Gratitude',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Let us be grateful for this one good day.' },
          { t: 'For the hands that fed us,' },
          { t: 'and the paths that carried us here.' },
          { t: 'May we spend our time being kind.' },
          { t: 'We carry no judgment but our own.' }
        ],
        translation: 'A secular prayer of thanks — to people, chance, and the plain good luck of being alive.'
      },
      {
        id: 'awe',
        title: 'A Breath of Awe',
        lang: 'en',
        langLabel: 'English',
        loop: true,
        phrases: [
          { t: 'Breathe in the stardust that made us.' },
          { t: 'Breathe out the worry of the hour.' },
          { t: 'We are small, and the universe is immense,' },
          { t: 'and here, together, we are not alone.' }
        ],
        translation: 'A meditation on wonder — a quiet moment under the same stars everyone has always looked up to.'
      },
      {
        id: 'wish',
        title: 'A Wish for the World',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'May every child sleep in peace tonight.' },
          { t: 'May the hungry be fed, and the weary rest.' },
          { t: 'May we leave this world softer than we found it.' },
          { t: 'This is the only prayer we need:' },
          { t: 'let us be good to one another.' }
        ],
        translation: 'A shared intention from the humanist heart — the good we owe each other without any god required.'
      },
      {
        id: 'for-earth',
        title: 'A Prayer for the Earth',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Let us hold the Earth gently,' },
          { t: 'this blue house of every breath.' },
          { t: 'May the forests keep their whisper,' },
          { t: 'the waters their quiet song.' },
          { t: 'May we leave the world softer,' },
          { t: 'and each other kinder, than we found them.' }
        ],
        translation: 'A secular prayer of stewardship and tenderness for the world we all share.'
      },
      {
        id: 'silent-minute',
        title: 'A Silent Minute',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Let this minute be for those we cannot see:' },
          { t: 'for the one who is lonely,' },
          { t: 'the one who is afraid,' },
          { t: 'the one who is far from home.' },
          { t: 'May their night be gentle,' },
          { t: 'and their morning kind.' }
        ],
        translation: 'A secular prayer of presence — one minute held for everyone we cannot reach.'
      },
      {
        id: 'for-skeptic',
        title: 'For the Skeptic',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'I do not know what listens,' },
          { t: 'but I know this moment is real.' },
          { t: 'Let me be honest in my wondering,' },
          { t: 'and generous in my acting.' },
          { t: 'If this is all there is,' },
          { t: 'let it be enough, and good.' }
        ],
        translation: 'A prayer for honest doubt — wonder without certainty, and goodness without a witness.'
      },
      {
        id: 'ode-to-day',
        title: 'Ode to the Day',
        lang: 'en',
        langLabel: 'English · a breath-prayer, repeated',
        loop: true,
        phrases: [
          { t: 'The sun has risen before us a thousand times.' },
          { t: 'Let us walk into it open-handed.' },
          { t: 'Let us give what we can spare,' },
          { t: 'and take only what we need.' },
          { t: 'Tonight we will rest,' },
          { t: 'and the Earth will turn for us all.' }
        ],
        translation: 'A secular dawn meditation — walking into the day with open hands.'
      }
    ]
  }
]

export const SPIRITUALITY_BY_ID = Object.fromEntries(
  SPIRITUALITIES.map((s) => [s.id, s])
)
