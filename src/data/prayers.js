// Prayers of the world.
// Each phrase: { t: text spoken aloud, s?: subtitle shown (e.g. transliteration), e?: meaning }
// spirituality.prayers[x].lang = BCP-47 code used by the speech engine.

export const SPIRITUALITIES = [
  {
    id: 'christianity',
    name: 'Christianity',
    emoji: '✝️',
    glow: 'rgba(201, 160, 60, 0.28)',
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
    id: 'nonreligious',
    name: 'Agnostic · Atheist',
    emoji: '🌌',
    glow: 'rgba(150, 170, 255, 0.24)',
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
