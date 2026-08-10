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
        translation: 'A prayer taught by Jesus to his disciples, of daily bread, forgiveness, and trust in a loving God.'
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
        translation: 'The great Marian prayer of the Church, a greeting of grace and a plea for intercession.'
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
        translation: 'A psalm of quiet trust, the shepherd who guides, provides, and stays near.'
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
        translation: "Mary's song of praise, a hymn of joy for the world turned right-side up."
      },
      {
        id: 'peace-prayer',
        title: 'The Peace Prayer',
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
        id: 'beatitudes',
        title: 'The Beatitudes',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Blessed are the peacemakers,' },
          { t: 'for they shall be called children of God.' },
          { t: 'Blessed are the merciful,' },
          { t: 'for they shall receive mercy.' },
          { t: 'Blessed are the pure in heart,' },
          { t: 'for they shall see God.' },
          { t: 'Blessed are the meek,' },
          { t: 'for they shall inherit the earth.' },
          { t: 'Blessed are those who hunger and thirst for justice,' },
          { t: 'for they shall be satisfied.' }
        ],
        translation: 'The blessings of Jesus, a vision of the gentle and the just who are closest to God.'
      },
      {
        id: 'psalm-100',
        title: 'Psalm 100, A Joyful Noise',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Make a joyful noise to the Lord, all the earth.' },
          { t: 'Serve the Lord with gladness; come into his presence with singing.' },
          { t: 'Know that the Lord is God. It is he who made us, and we are his.' },
          { t: 'We are his people, and the sheep of his pasture.' },
          { t: 'Enter his gates with thanksgiving, and his courts with praise.' },
          { t: 'For the Lord is good; his steadfast love endures forever.' }
        ],
        translation: 'A psalm of pure gladness, gratitude, and belonging, a call to come before God with joy.'
      },
      {
        id: 'psalm-121',
        title: 'Psalm 121, A Prayer of Safe-Keeping',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'I lift up my eyes to the hills. From where does my help come?' },
          { t: 'My help comes from the Lord, who made heaven and earth.' },
          { t: 'He who keeps you will not slumber; he who watches over you will not sleep.' },
          { t: 'The Lord will keep you from all harm; he will watch over your life.' },
          { t: 'The Lord will watch over your going out and your coming in, now and forever.' }
        ],
        translation: 'A psalm of trust and protection, the assurance that we are watched over through every journey.'
      },
      {
        id: 'psalm-46',
        title: 'Psalm 46, Be Still',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'God is our refuge and strength, a very present help in trouble.' },
          { t: 'Therefore we will not fear, though the earth should change.' },
          { t: 'Be still, and know that I am God.' },
          { t: 'I will be exalted among the nations, I will be exalted in the earth.' },
          { t: 'The Lord of hosts is with us; the God of Jacob is our refuge.' }
        ],
        translation: 'A psalm of stillness and courage, the quiet assurance of a God who is our shelter.'
      },
      {
        id: 'psalm-139',
        title: 'Psalm 139, Wonderfully Made',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'O Lord, you have searched me and known me.' },
          { t: 'You knit me together in my mother\u2019s womb.' },
          { t: 'I praise you, for I am fearfully and wonderfully made.' },
          { t: 'Wonderful are your works; my soul knows it very well.' },
          { t: 'Search me, O God, and know my heart; lead me in the way everlasting.' }
        ],
        translation: 'A psalm of wonder at being known and made with love, an invitation to be led in a good way.'
      },
      {
        id: 'greatest-commandment',
        title: 'The Greatest Commandment',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Hear, O Israel: the Lord our God, the Lord is one.' },
          { t: 'You shall love the Lord your God with all your heart,' },
          { t: 'and with all your soul, and with all your mind, and with all your strength.' },
          { t: 'And you shall love your neighbor as yourself.' },
          { t: 'There is no commandment greater than these.' }
        ],
        translation: 'The heart of Jesus\u2019 teaching, the whole law summed up in love of God and love of neighbor.'
      },
      {
        id: 'love-is-patient',
        title: 'Love Is Patient',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Love is patient; love is kind.' },
          { t: 'Love is not envious or boastful or arrogant or rude.' },
          { t: 'It does not insist on its own way; it is not irritable or resentful.' },
          { t: 'It does not rejoice in wrongdoing, but rejoices in the truth.' },
          { t: 'Love bears all things, believes all things, hopes all things, endures all things.' },
          { t: 'And now faith, hope, and love abide, these three; and the greatest of these is love.' }
        ],
        translation: 'The hymn of love from the first letter to the Corinthians, a portrait of how to hold one another.'
      },
      {
        id: 'canticle-of-creation',
        title: 'The Canticle of Creation',
        lang: 'en',
        langLabel: 'English \u00b7 attributed to Saint Francis',
        phrases: [
          { t: 'Praised be you, my Lord, with all your creatures,' },
          { t: 'especially our brother sun, who brings us the day and the light.' },
          { t: 'Praised be you for sister moon and the stars, clear and precious and fair.' },
          { t: 'Praised be you for our sister water, useful, humble, precious, and pure.' },
          { t: 'Praised be you for our sister mother earth, who sustains and guides us.' },
          { t: 'Praise and bless my Lord, and give thanks, and serve him with great humility.' }
        ],
        translation: 'Saint Francis\u2019 hymn of praise to the Creator through sun, moon, water, and the living earth.'
      },
      {
        id: 'suscipe',
        title: 'Suscipe, Take and Receive',
        lang: 'en',
        langLabel: 'English \u00b7 attributed to Saint Ignatius',
        phrases: [
          { t: 'Take, Lord, and receive all my liberty, my memory, my understanding, and my entire will.' },
          { t: 'All I have and call my own, you have given me; to you, Lord, I return it.' },
          { t: 'Everything is yours; do with it what you will.' },
          { t: 'Give me only your love and your grace,' },
          { t: 'for with these I am rich enough, and ask for nothing more.' }
        ],
        translation: 'The prayer of total surrender of Saint Ignatius of Loyola, giving everything back to God with joy.'
      },
      {
        id: 'benedictus',
        title: 'The Benedictus',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Blessed be the Lord, the God of Israel,' },
          { t: 'who has visited and redeemed his people.' },
          { t: 'In the tender compassion of our God,' },
          { t: 'the dawn from on high shall break upon us,' },
          { t: 'to give light to those who sit in darkness and in the shadow of death,' },
          { t: 'and to guide our feet into the way of peace.' }
        ],
        translation: 'The song of Zechariah, a hymn of hope that the dawn of mercy will guide us into peace.'
      },
      {
        id: 'psalm-150',
        title: 'Psalm 150, Let Everything Praise',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Praise the Lord!' },
          { t: 'Praise God in his sanctuary; praise him in his mighty firmament.' },
          { t: 'Praise him with trumpet sound, with lute and harp,' },
          { t: 'with tambourine and dance, with strings and pipe.' },
          { t: 'Let everything that breathes praise the Lord. Praise the Lord!' }
        ],
        translation: 'The final psalm, a joyful burst of music and dance in which all of creation praises.'
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
        title: 'Al-Fātiḥah, The Opening',
        lang: 'ar',
        langLabel: 'العربية · Arabic',
        phrases: [
          { t: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', s: 'Bismillāhir-raḥmānir-raḥīm', e: 'In the name of God, the Most Gracious, the Most Merciful.' },
          { t: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ', s: 'Al-ḥamdu lillāhi rabbil-ʿālamīn', e: 'All praise is for God, Lord of all the worlds.' },
          { t: 'الرَّحْمَٰنِ الرَّحِيمِ', s: 'Ar-raḥmānir-raḥīm', e: 'The Most Gracious, the Most Merciful.' },
          { t: 'مَالِكِ يَوْمِ الدِّينِ', s: 'Māliki yawmid-dīn', e: 'Master of the Day of Judgment.' },
          { t: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ', s: 'Iyyāka naʿbudu wa-iyyāka nastaʿīn', e: 'You alone we worship, and You alone we ask for help.' },
          { t: 'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ', s: 'Ihdināṣ-ṣirāṭal-mustaqīm', e: 'Guide us along the straight path.' },
          { t: 'صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ', s: 'Ṣirāṭal-laḏīna anʿamta ʿalayhim, ghayril-maghḍūbi ʿalayhim wa-laḍ-ḍāllīn', e: 'The path of those You have blessed, not those who earned anger, nor those astray.' }
        ],
        translation: 'The opening chapter of the Qurʼan, recited in every prayer of the day.'
      },
      {
        id: 'ayat-al-kursi',
        title: 'Āyat al-Kursī, The Throne Verse',
        lang: 'ar',
        langLabel: 'العربية · Arabic',
        phrases: [
          { t: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ', s: 'Allāhu lā ilāha illā huwal-ḥayyul-qayyūm', e: 'God, there is no deity except Him, the Ever-Living, the Sustainer of all.' },
          { t: 'لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ', s: 'Lā taʾkhuḏuhū sinatun wa-lā nawm', e: 'Neither drowsiness nor sleep overtakes Him.' },
          { t: 'لَهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ', s: 'Lahū mā fis-samāwāti wa-mā fil-arḍ', e: 'To Him belongs all that is in the heavens and all that is on the earth.' },
          { t: 'وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ', s: 'Wasiʿa kursiyyuhus-samāwāti wal-arḍ', e: 'His throne extends over the heavens and the earth.' },
          { t: 'وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ', s: 'Wa-lā yaʾūduhū ḥifẓuhumā, wa-huwal-ʿaliyyul-ʿaẓīm', e: 'Their preservation does not tire Him, for He is the Most High, the Magnificent.' }
        ],
        translation: 'A verse treasured across the Muslim world as a shield and a prayer of trust.'
      },
      {
        id: 'dua-yunus',
        title: "Du'a of Yūnus, The Prophet's Call",
        lang: 'ar',
        langLabel: 'العربية · Arabic · repeated',
        loop: true,
        phrases: [
          { t: 'لَا إِلَٰهَ إِلَّا أَنتَ سُبْحَانَكَ إِنِّي كُنتُ مِنَ الظَّالِمِينَ', s: 'Lā ilāha illā anta subḥānaka innī kuntu minaẓ-ẓālimīn', e: 'There is no god but You. Glory be to You, indeed, I was among the wrongdoers.' }
        ],
        translation: 'The cry of the Prophet Jonah from the depths, answered by mercy, a prayer of total turning back to God.'
      },
      {
        id: 'istighfar',
        title: 'Istighfar, Seeking Forgiveness',
        lang: 'ar',
        langLabel: 'العربية · Arabic · repeated',
        loop: true,
        phrases: [
          { t: 'أَسْتَغْفِرُ اللَّهَ', s: 'Astaghfirullāh', e: 'I seek Godʼs forgiveness.' },
          { t: 'أَسْتَغْفِرُ اللَّهَ رَبِّي مِنْ كُلِّ ذَنْبٍ وَأَتُوبُ إِلَيْهِ', s: 'Astaghfirullāha rabbī min kulli dhambin wa-atūbu ilayh', e: 'I seek forgiveness from God, my Lord, for every sin, and I turn to Him.' }
        ],
        translation: 'The simple, endless act of turning, seeking forgiveness, then turning again to God.'
      },
      {
        id: 'durood',
        title: 'Salawāt, Blessings on the Prophet',
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
        id: 'al-falaq',
        title: 'Sūrat al-Falaq, The Daybreak',
        lang: 'ar',
        langLabel: 'العربية · Arabic',
        phrases: [
          { t: 'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ', s: 'Qul aʿūdhu bi-rabbil-falaq', e: 'Say: I seek refuge in the Lord of the daybreak,' },
          { t: 'مِن شَرِّ مَا خَلَقَ', s: 'Min sharri mā khalaq', e: 'from the evil of what He has created,' },
          { t: 'وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ', s: 'Wa-min sharri ghāsiqin idhā waqab', e: 'and from the evil of the darkness as it falls,' },
          { t: 'وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ', s: 'Wa-min sharrin-naffāthāti fil-ʿuqad', e: 'and from the evil of those who blow on knots,' },
          { t: 'وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ', s: 'Wa-min sharri ḥāsidin idhā ḥasad', e: 'and from the evil of the envier when he envies.' }
        ],
        translation: 'A chapter of protection recited at dawn and dusk, shelter for the night, and for the fears within.'
      },
      {
        id: 'al-ikhlas',
        title: 'Sūrat al-Ikhlāṣ, Purity',
        lang: 'ar',
        langLabel: 'العربية · Arabic · repeated',
        loop: true,
        phrases: [
          { t: 'قُلْ هُوَ اللَّهُ أَحَدٌ', s: 'Qul huwa Allāhu aḥad', e: 'Say: He is God, the One.' },
          { t: 'اللَّهُ الصَّمَدُ', s: 'Allāhuṣ-ṣamad', e: 'God, the Eternal Refuge.' },
          { t: 'لَمْ يَلِدْ وَلَمْ يُولَدْ', s: 'Lam yalid wa-lam yūlad', e: 'He neither begets nor is born.' },
          { t: 'وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ', s: 'Wa-lam yakun lahū kufuwan aḥad', e: 'And there is none comparable to Him.' }
        ],
        translation: 'The chapter of Divine Unity, called by the Prophet equal to a third of the Qurʼan.'
      },
      {
        id: 'basmala',
        title: 'The Basmala',
        lang: 'ar',
        langLabel: 'العربية · Arabic · repeated',
        loop: true,
        phrases: [
          { t: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', s: 'Bismillāhir-raḥmānir-raḥīm', e: 'In the name of God, the Most Gracious, the Most Merciful.' },
          { t: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', s: 'Bismillāhir-raḥmānir-raḥīm', e: 'In the name of God, the Most Gracious, the Most Merciful.' }
        ],
        translation: 'The sacred phrase that begins every chapter and every good deed, a breath of mercy before all things.'
      },
      {
        id: 'rabbana-atina',
        title: 'Rabbana Ātinā',
        lang: 'ar',
        langLabel: 'العربية · Arabic',
        phrases: [
          { t: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً', s: 'Rabbanā ātinā fid-dunyā ḥasanah', e: 'Our Lord, give us good in this world,' },
          { t: 'وَفِي الْآخِرَةِ حَسَنَةً', s: 'Wa-fil-ākhirati ḥasanah', e: 'and good in the world to come,' },
          { t: 'وَقِنَا عَذَابَ النَّارِ', s: 'Wa-qinā ʿaḏāban-nār', e: 'and shield us from harm.' }
        ],
        translation: 'A verse prayed for goodness in this life and the next, a request for beauty, safety, and peace.'
      },
      {
        id: 'tasbih',
        title: 'The Tasbih of Praise',
        lang: 'ar',
        langLabel: 'العربية · Arabic · repeated',
        loop: true,
        phrases: [
          { t: 'سُبْحَانَ اللَّهِ', s: 'Subḥān Allāh', e: 'Glory to God.' },
          { t: 'الْحَمْدُ لِلَّهِ', s: 'Al-ḥamdu lillāh', e: 'All praise is for God.' },
          { t: 'اللَّهُ أَكْبَرُ', s: 'Allāhu akbar', e: 'God is the greatest.' }
        ],
        translation: 'The simple round of praise spoken on the beads, glory, gratitude, and the greatness of God.'
      },
      {
        id: 'dua-musa',
        title: "Du'a of Mūsā",
        lang: 'ar',
        langLabel: 'العربية · Arabic',
        phrases: [
          { t: 'رَبِّ اشْرَحْ لِي صَدْرِي', s: 'Rabbi-shraḥ lī ṣadrī', e: 'My Lord, open up my heart,' },
          { t: 'وَيَسِّرْ لِي أَمْرِي', s: 'Wa-yassir lī amrī', e: 'and make my task easy for me.' },
          { t: 'وَاحْلُلْ عُقْدَةً مِّن لِّسَانِي', s: 'Wa-ḥlul ʿuqdatan min lisānī', e: 'And loosen the knot from my tongue,' },
          { t: 'يَفْقَهُوا قَوْلِي', s: 'Yafqahū qawlī', e: 'that they may understand my words.' }
        ],
        translation: 'The prayer of Prophet Moses for an open heart, an easy task, and clear speech — a prayer of courage and calm.'
      },
      {
        id: 'dua-ibrahim',
        title: "Du'a of Ibrāhīm",
        lang: 'ar',
        langLabel: 'العربية · Arabic',
        phrases: [
          { t: 'رَبَّنَا اجْعَلْنَا مُسْلِمَيْنِ لَكَ', s: 'Rabbanā-jʿalnā muslimayni laka', e: 'Our Lord, make us people who surrender to You,' },
          { t: 'وَمِن ذُرِّيَّتِنَا أُمَّةً مُّسْلِمَةً لَّكَ', s: 'Wa-min dhurriyyatinā ummatan muslimatan laka', e: 'and from our descendants a community surrendered to You.' },
          { t: 'وَأَرِنَا مَنَاسِكَنَا', s: 'Wa-arina manāsikanā', e: 'Show us how to worship,' },
          { t: 'وَتُبْ عَلَيْنَا ۖ إِنَّكَ أَنتَ التَّوَّابُ الرَّحِيمُ', s: 'Wa-tub ʿalaynā, innaka antat-tawwābur-raḥīm', e: 'and turn to us with mercy; truly You are the Accepting, the Merciful.' }
        ],
        translation: 'The prayer of Prophet Abraham for hearts surrendered to God and a community of peace.'
      },
      {
        id: 'rabbana-la-tuzigh',
        title: 'Rabbana Lā Tuzigh',
        lang: 'ar',
        langLabel: 'العربية · Arabic',
        phrases: [
          { t: 'رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا', s: 'Rabbanā lā tuzigh qulūbanā baʿda idh hadaytanā', e: 'Our Lord, let not our hearts stray after You have guided us,' },
          { t: 'وَهَبْ لَنَا مِن لَّدُنكَ رَحْمَةً', s: 'Wa-hab lanā min ladunka raḥmah', e: 'and bestow upon us mercy from Yourself.' },
          { t: 'إِنَّكَ أَنتَ الْوَهَّابُ', s: 'Innaka antal-wahhāb', e: 'Truly, You are the Bestower.' }
        ],
        translation: 'A Quranic prayer to stay steady on the good path and to receive the gift of mercy.'
      },
      {
        id: 'dua-nabi-knowledge',
        title: 'A Prayer for Knowledge',
        lang: 'ar',
        langLabel: 'العربية · Arabic',
        phrases: [
          { t: 'اللَّهُمَّ انْفَعْنِي بِمَا عَلَّمْتَنِي', s: 'Allāhumma-nfaʿnī bimā ʿallamtanī', e: 'O God, benefit me with what You have taught me,' },
          { t: 'وَعَلِّمْنِي مَا يَنْفَعُنِي', s: 'Wa-ʿallimnī mā yanfaʿunī', e: 'and teach me what will benefit me,' },
          { t: 'وَزِدْنِي عِلْمًا', s: 'Wa-zidnī ʿilman', e: 'and increase me in knowledge.' }
        ],
        translation: 'A beloved prophetic prayer for learning that serves, and a heart that grows in wisdom.'
      },
      {
        id: 'al-ashr',
        title: 'Sūrat al-ʿAṣr, The Time',
        lang: 'ar',
        langLabel: 'العربية · Arabic',
        phrases: [
          { t: 'وَالْعَصْرِ', s: 'Wal-ʿaṣr', e: 'By the passing of time,' },
          { t: 'إِنَّ الْإِنسَانَ لَفِي خُسْرٍ', s: 'Innal-insāna lafī khusr', e: 'truly, humankind is in loss,' },
          { t: 'إِلَّا الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ', s: 'Illal-ladhīna āmanū wa-ʿamiluṣ-ṣāliḥāt', e: 'except those who believe, do good deeds,' },
          { t: 'وَتَوَاصَوْا بِالْحَقِّ وَتَوَاصَوْا بِالصَّبْرِ', s: 'Wa-tawāṣaw bil-ḥaqqi wa-tawāṣaw biṣ-ṣabr', e: 'and encourage one another to truth and to patience.' }
        ],
        translation: 'A short chapter of the Qur\u2019an on the value of time, goodness, and encouraging one another in patience.'
      },
      {
        id: 'ayat-nur',
        title: 'Āyat an-Nūr, The Light',
        lang: 'ar',
        langLabel: 'العربية · Arabic',
        phrases: [
          { t: 'اللَّهُ نُورُ السَّمَاوَاتِ وَالْأَرْضِ', s: 'Allāhu nūrus-samāwāti wal-arḍ', e: 'God is the Light of the heavens and the earth.' },
          { t: 'مَثَلُ نُورِهِ كَمِشْكَاةٍ فِيهَا مِصْبَاحٌ', s: 'Mathalu nūrihi kamishkātin fīhā miṣbāḥ', e: 'The likeness of His light is a niche in which there is a lamp.' },
          { t: 'الْمِصْبَاحُ فِي زُجَاجَةٍ', s: 'Al-miṣbāḥu fī zujājah', e: 'The lamp within a glass,' },
          { t: 'يُوقَدُ مِن شَجَرَةٍ مُّبَارَكَةٍ', s: 'Yūqadu min shajaratin mubārakah', e: 'lit from a blessed tree,' },
          { t: 'نُورٌ عَلَى نُورٍ', s: 'Nūrun ʿalā nūr', e: 'light upon light.' }
        ],
        translation: 'The verse of Light, a luminous image of divine guidance shining upon the world.'
      },
      {
        id: 'dua-sabr',
        title: 'A Prayer for Patience',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'O God, grant me patience when the road is long,' },
          { t: 'and gratitude when the day is bright.' },
          { t: 'Help me to be gentle with myself and others,' },
          { t: 'and to trust that every season has its purpose.' },
          { t: 'Make my heart like water — clear, calm, and ever-flowing.' }
        ],
        translation: 'A gentle prayer for patience and trust, written in the spirit of sabr.'
      },
      {
        id: 'dua-salam',
        title: 'The Greeting of Peace',
        lang: 'ar',
        langLabel: 'العربية · Arabic · repeated',
        loop: true,
        phrases: [
          { t: 'السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ', s: 'As-salāmu ʿalaykum wa-raḥmatullāh', e: 'Peace be upon you, and the mercy of God.' },
          { t: 'وَبَرَكَاتُهُ', s: 'Wa-barakātuh', e: 'and His blessings.' }
        ],
        translation: 'The daily greeting of the Muslim world, peace and mercy wished upon all you meet.'
      },
      {
        id: 'rabbana-ghufran',
        title: 'Rabbana, A Prayer of Grace',
        lang: 'ar',
        langLabel: 'العربية · Arabic',
        phrases: [
          { t: 'رَبَّنَا اغْفِرْ لَنَا وَلِإِخْوَانِنَا', s: 'Rabbanā-ghfir lanā wa-li-ikhwāninā', e: 'Our Lord, forgive us and our brothers and sisters,' },
          { t: 'الَّذِينَ سَبَقُونَا بِالْإِيمَانِ', s: 'Alladhīna sabaqūnā bil-īmān', e: 'who came before us in faith,' },
          { t: 'وَلَا تَجْعَلْ فِي قُلُوبِنَا غِلًّا لِّلَّذِينَ آمَنُوا', s: 'Wa-lā tajʿal fī qulūbinā ghillan lilladhīna āmanū', e: 'and leave no rancor in our hearts toward those who believe.' },
          { t: 'رَبَّنَا إِنَّكَ رَءُوفٌ رَّحِيمٌ', s: 'Rabbanā innaka ra\u2019ūfur-raḥīm', e: 'Our Lord, truly You are Kind, Merciful.' }
        ],
        translation: 'A Quranic prayer for forgiveness and a heart free of resentment toward all who share the path.'
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
        translation: 'The Upanishadic peace invocation, a journey from darkness toward light and stillness.'
      },
      {
        id: 'ram-nam',
        title: 'Śrī Rām Jai Rām',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit · repeated',
        loop: true,
        phrases: [
          { t: 'श्री राम जय राम जय जय राम', s: 'Śrī Rām jay Rām jay jay Rām', e: 'Glory to Rama, the divine light within all things.' },
          { t: 'श्री राम जय राम जय जय राम', s: 'Śrī Rām jay Rām jay jay Rām', e: 'Glory to Rama, the divine light within all things.' },
          { t: 'श्री राम जय राम जय जय राम', s: 'Śrī Rām jay Rām jay jay Rām', e: 'Glory to Rama, the divine light within all things.' }
        ],
        translation: 'The simple chanting of the divine Name, devotion made of nothing but love.'
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
        translation: 'The great mantra of the heart from the Vaishnava tradition, the divine names sung until the mind grows still.'
      },
      {
        id: 'purnamadah',
        title: 'The Invocation of Fullness',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit',
        phrases: [
          { t: 'ॐ पूर्णमदः पूर्णमिदम्', s: 'Om pūrṇamadaḥ pūrṇamidam', e: 'Om. That is whole; this is whole.' },
          { t: 'पूर्णात् पूर्णमुदच्यते', s: 'Pūrṇāt pūrṇam udacyate', e: 'From wholeness, wholeness arises.' },
          { t: 'पूर्णस्य पूर्णमादाय पूर्णमेवावशिष्यते', s: 'Pūrṇasya pūrṇam ādāya pūrṇam evāvaśiṣyate', e: 'Take wholeness from wholeness, and wholeness still remains.' },
          { t: 'ॐ शान्तिः शान्तिः शान्तिः', s: 'Om śāntiḥ śāntiḥ śāntiḥ', e: 'Om. Peace, peace, peace.' }
        ],
        translation: 'An Upanishadic invocation of the fullness that never diminishes, a meditation on the infinite whole.'
      },
      {
        id: 'loka-samastah',
        title: 'Lokah Samastah',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit · repeated',
        loop: true,
        phrases: [
          { t: 'लोकाः समस्ताः सुखिनो भवन्तु', s: 'Lokāḥ samastāḥ sukhino bhavantu', e: 'May all beings everywhere be happy and free.' },
          { t: 'लोकाः समस्ताः सुखिनो भवन्तु', s: 'Lokāḥ samastāḥ sukhino bhavantu', e: 'May all beings everywhere be happy and free.' }
        ],
        translation: 'A beloved wish for universal well-being, that no one anywhere be left out of happiness.'
      },
      {
        id: 'om-ganeshaya',
        title: 'Om Gaṇeśāya',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit · repeated',
        loop: true,
        phrases: [
          { t: 'ॐ गं गणपतये नमः', s: 'Om gaṁ gaṇapataye namaḥ', e: 'Om, I bow to the remover of obstacles.' },
          { t: 'ॐ गं गणपतये नमः', s: 'Om gaṁ gaṇapataye namaḥ', e: 'Om, I bow to the remover of obstacles.' }
        ],
        translation: 'A gentle mantra to Ganesha, who clears the way and blesses every new beginning.'
      },
      {
        id: 'saraswati-vandana',
        title: 'Sarasvatī Vandana',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit',
        phrases: [
          { t: 'या कुन्देन्दुतुषारहारधवला', s: 'Yā kundendutuṣārahāradhavalā', e: 'She who is fair as the jasmine, the moon, and snow,' },
          { t: 'या शुभ्रवस्त्रावृता', s: 'Yā śubhravastrāvṛtā', e: 'clothed in radiant white,' },
          { t: 'या वीणावरदण्डमण्डितकरा', s: 'Yā vīṇāvaradaṇḍamaṇḍitakarā', e: 'her hand adorned with the veena,' },
          { t: 'या श्वेतपद्मासना', s: 'Yā śvetapadmāsanā', e: 'seated upon the white lotus,' },
          { t: 'सा मां पातु सरस्वती भगवती निःशेषजाड्यापहा', s: 'Sā māṁ pātu sarasvatī bhagavatī niḥśeṣajāḍyāpahā', e: 'may that goddess Saraswati protect me and remove all dullness of mind.'
        },
        ],
        translation: 'A vandana, a prayer of homage to Saraswati, the goddess of wisdom, speech, and the arts.'
      },
      {
        id: 'surya-namaskara',
        title: 'Sūrya Namaskāra, Sun Salutation',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit',
        phrases: [
          { t: 'ॐ मित्राय नमः', s: 'Om mitrāya namaḥ', e: 'Om, I bow to the friend of all — the sun.' },
          { t: 'ॐ रवये नमः', s: 'Om ravaye namaḥ', e: 'Om, I bow to the radiant one.' },
          { t: 'ॐ सूर्याय नमः', s: 'Om sūryāya namaḥ', e: 'Om, I bow to the giver of light and life.' },
          { t: 'ॐ भानवे नमः', s: 'Om bhānave namaḥ', e: 'Om, I bow to the illuminator.' }
        ],
        translation: 'The mantras of the sun salutation, a greeting of gratitude to the light that wakes the world.'
      },
      {
        id: 'om-namah-narayanaya',
        title: 'Om Namo Nārāyaṇāya',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit · repeated',
        loop: true,
        phrases: [
          { t: 'ॐ नमो नारायणाय', s: 'Om namo nārāyaṇāya', e: 'Om, I bow to the Lord who dwells in all things.' },
          { t: 'ॐ नमो नारायणाय', s: 'Om namo nārāyaṇāya', e: 'Om, I bow to the Lord who dwells in all things.' }
        ],
        translation: 'An eight-syllable mantra of devotion to the divine presence that upholds the universe.'
      },
      {
        id: 'gita-love',
        title: 'The One Dear to Me',
        lang: 'en',
        langLabel: 'English · from the Bhagavad Gita',
        phrases: [
          { t: 'One who is not hostile to any being,' },
          { t: 'who is friendly and compassionate,' },
          { t: 'free from possessiveness and from ego,' },
          { t: 'balanced in joy and sorrow, patient and forgiving,' },
          { t: 'ever content, self-controlled, and firm in purpose —' },
          { t: 'such a one is dear to me.' }
        ],
        translation: 'From the Bhagavad Gita, the portrait of the person who is most dear to the Divine.'
      },
      {
        id: 'atma-shatakam',
        title: 'Ātma Ṣaṭakam, The Song of the Self',
        lang: 'en',
        langLabel: 'English · attributed to Shankara',
        phrases: [
          { t: 'I am not the mind, the intellect, the ego, or the memory.' },
          { t: 'I am not the five senses; I am beyond them all.' },
          { t: 'I am not the earth, water, fire, air, or space.' },
          { t: 'I am that pure consciousness, the witness of all —' },
          { t: 'ever free, ever blissful, one with the eternal.' }
        ],
        translation: 'Shankara\u2019s Nirvana Shatakam, a meditation on the innermost Self that is peace itself.'
      },
      {
        id: 'devi-gayatri',
        title: 'The Devī Gāyatrī',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit',
        phrases: [
          { t: 'ॐ सर्वदेवाय विद्महे', s: 'Om sarvadevāya vidmahe', e: 'Om, we know the divine in all its forms,' },
          { t: 'सर्वशक्त्यै धीमहि', s: 'Sarvaśaktyai dhīmahi', e: 'we meditate on the great power of the Mother,' },
          { t: 'तन्नो देवी प्रचोदयात्', s: 'Tanno devī pracodayāt', e: 'may the Goddess illumine and guide our minds.' }
        ],
        translation: 'A Gāyatrī honouring the divine Mother, the power of love and courage within all things.'
      },
      {
        id: 'shri-lakshmi',
        title: 'A Prayer of Gratitude to Lakṣmī',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit · repeated',
        loop: true,
        phrases: [
          { t: 'ॐ श्रीं महालक्ष्म्यै नमः', s: 'Om śrīṁ mahālakṣmyai namaḥ', e: 'Om, I bow to Lakshmi, the giver of abundance.' },
          { t: 'ॐ श्रीं महालक्ष्म्यै नमः', s: 'Om śrīṁ mahālakṣmyai namaḥ', e: 'Om, I bow to Lakshmi, the giver of abundance.' }
        ],
        translation: 'A mantra of gratitude for abundance — health, wisdom, and kindness shared with all.'
      },
      {
        id: 'sitaram',
        title: 'Sītā Rām',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit · repeated',
        loop: true,
        phrases: [
          { t: 'सीता राम', s: 'Sītā Rām', e: 'Sita and Rama — love and righteousness.' },
          { t: 'सीता राम', s: 'Sītā Rām', e: 'Sita and Rama — love and righteousness.' }
        ],
        translation: 'The sweet repetition of the holy names of Sita and Rama, a meditation on love and dharma.'
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
        translation: 'The beloved mantra of Tibetan Buddhism, compassion taking shape as sound.'
      },
      {
        id: 'amitabha',
        title: 'Amitābha Mantra',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit · repeated',
        loop: true,
        phrases: [
          { t: 'ॐ अमिदेव ह्रीः', s: 'Om amideva hrīḥ', e: 'Homage to Amitabha, the Buddha of boundless light.' },
          { t: 'ॐ अमिदेव ह्रीः', s: 'Om amideva hrīḥ', e: 'Homage to Amitabha, the Buddha of boundless light.' },
          { t: 'ॐ अमिदेव ह्रीः', s: 'Om amideva hrīḥ', e: 'Homage to Amitabha, the Buddha of boundless light.' }
        ],
        translation: 'The mantra of Amitabha, recited for rebirth in the Pure Land of boundless light.'
      },
      {
        id: 'amoghasiddhi',
        title: 'Amoghasiddhi Mantra',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit · repeated',
        loop: true,
        phrases: [
          { t: 'ॐ अमोघसिद्धि आः हूं', s: 'Om amoghasiddhi āḥ hūṃ', e: 'Homage to Amoghasiddhi, the Buddha of unfailing accomplishment.' },
          { t: 'ॐ अमोघसिद्धि आः हूं', s: 'Om amoghasiddhi āḥ hūṃ', e: 'Homage to Amoghasiddhi, the Buddha of unfailing accomplishment.' },
          { t: 'ॐ अमोघसिद्धि आः हूं', s: 'Om amoghasiddhi āḥ hūṃ', e: 'Homage to Amoghasiddhi, the Buddha of unfailing accomplishment.' }
        ],
        translation: 'The mantra of the northern Buddha Amoghasiddhi, the power to complete whatever is undertaken.'
      },
      {
        id: 'cundi',
        title: 'Cundī Mantra',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit · repeated',
        loop: true,
        phrases: [
          { t: 'ॐ चले चुले चुन्दे स्वाहा', s: 'Om cale cule cunde svāhā', e: 'The Cundi mantra, the mother of all Buddhas, swift blessings.' },
          { t: 'ॐ चले चुले चुन्दे स्वाहा', s: 'Om cale cule cunde svāhā', e: 'The Cundi mantra, the mother of all Buddhas, swift blessings.' },
          { t: 'ॐ चले चुले चुन्दे स्वाहा', s: 'Om cale cule cunde svāhā', e: 'The Cundi mantra, the mother of all Buddhas, swift blessings.' }
        ],
        translation: 'The mantra of the Great Mother Cundi, recited for swift blessings and the removal of obstacles.'
      },
      {
        id: 'guru-rinpoche',
        title: 'Guru Rinpoche Mantra',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit · repeated',
        loop: true,
        phrases: [
          { t: 'ॐ आः हूं वज्र गुरु पद्म सिद्धि हूं', s: 'Om āḥ hūṃ vajra guru padma siddhi hūṃ', e: 'The prayer of Guru Rinpoche, the blessing of the lotus-born master.' },
          { t: 'ॐ आः हूं वज्र गुरु पद्म सिद्धि हूं', s: 'Om āḥ hūṃ vajra guru padma siddhi hūṃ', e: 'The prayer of Guru Rinpoche, the blessing of the lotus-born master.' },
          { t: 'ॐ आः हूं वज्र गुरु पद्म सिद्धि हूं', s: 'Om āḥ hūṃ vajra guru padma siddhi hūṃ', e: 'The prayer of Guru Rinpoche, the blessing of the lotus-born master.' }
        ],
        translation: 'The Vajra Guru mantra of Padmasambhava, recited for blessings, protection, and the swift attainment of siddhi.'
      },
      {
        id: 'heart-sutra',
        title: 'Heart Sutra Mantra',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit · repeated',
        loop: true,
        phrases: [
          { t: 'गते गते पारगते पारसंगते बोधि स्वाहा', s: 'Gate gate pāragate pārasaṃgate bodhi svāhā', e: 'Gone, gone, gone beyond, gone utterly beyond, awakening, so be it.' },
          { t: 'गते गते पारगते पारसंगते बोधि स्वाहा', s: 'Gate gate pāragate pārasaṃgate bodhi svāhā', e: 'Gone, gone, gone beyond, gone utterly beyond, awakening, so be it.' },
          { t: 'गते गते पारगते पारसंगते बोधि स्वाहा', s: 'Gate gate pāragate pārasaṃgate bodhi svāhā', e: 'Gone, gone, gone beyond, gone utterly beyond, awakening, so be it.' }
        ],
        translation: 'The mantra of the Heart Sutra, the very heart of emptiness, recited as the crown of the Perfection of Wisdom.'
      },
      {
        id: 'ksitigarbha',
        title: 'Kṣitigarbha Mantra',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit · repeated',
        loop: true,
        phrases: [
          { t: 'ॐ प्रमर्दने स्वाहा', s: 'Oṃ pramardane svāhā', e: 'May fixed karma be dissolved, the Ksitigarbha dhāraṇī of liberation.' },
          { t: 'ॐ प्रमर्दने स्वाहा', s: 'Oṃ pramardane svāhā', e: 'May fixed karma be dissolved, the Ksitigarbha dhāraṇī of liberation.' },
          { t: 'ॐ प्रमर्दने स्वाहा', s: 'Oṃ pramardane svāhā', e: 'May fixed karma be dissolved, the Ksitigarbha dhāraṇī of liberation.' }
        ],
        translation: 'The Ksitigarbha dhāraṇī of eliminating fixed karma, Ksitigarbha, the earth-womb bodhisattva who vowed not to rest until every being is saved.'
      },
      {
        id: 'manjushri',
        title: 'Mañjuśrī Mantra',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit · repeated',
        loop: true,
        phrases: [
          { t: 'ॐ अ र प च न धीः', s: 'Om a ra pa ca na dhīḥ', e: 'The seed syllables of Manjushri, the bodhisattva of wisdom.' },
          { t: 'ॐ अ र प च न धीः', s: 'Om a ra pa ca na dhīḥ', e: 'The seed syllables of Manjushri, the bodhisattva of wisdom.' },
          { t: 'ॐ अ र प च न धीः', s: 'Om a ra pa ca na dhīḥ', e: 'The seed syllables of Manjushri, the bodhisattva of wisdom.' }
        ],
        translation: 'The mantra of Manjushri, recited to sharpen wisdom and cut through confusion.'
      },
      {
        id: 'medicine-buddha-long',
        title: 'Medicine Buddha · The Long Mantra',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit · repeated',
        loop: true,
        phrases: [
          { t: 'नमो भगवते भैषज्यगुरु वैडूर्यप्रभराजाय तथागताय अर्हते सम्यक्संबुद्धाय', s: 'Namo bhagavate bhaiṣajyaguru vaiḍūryaprabharājāya tathāgatāya arhate samyaksaṃbuddhāya', e: 'Homage to the Medicine Buddha, king of the lapis-lazuli light, the one who has awakened.' },
          { t: 'तद्यथा ॐ भैषज्ये भैषज्ये महाभैषज्ये राज समुद्गते स्वाहा', s: 'Tadyathā: Oṃ bhaiṣajye bhaiṣajye mahābhaiṣajye rāja samudgate svāhā', e: 'Thus: Oṃ, heal, heal, great healing, king arisen from the depths, so be it.' },
          { t: 'तद्यथा ॐ भैषज्ये भैषज्ये महाभैषज्ये राज समुद्गते स्वाहा', s: 'Tadyathā: Oṃ bhaiṣajye bhaiṣajye mahābhaiṣajye rāja samudgate svāhā', e: 'Thus: Oṃ, heal, heal, great healing, king arisen from the depths, so be it.' }
        ],
        translation: 'The long Medicine Buddha mantra, the full homage to Bhaiṣajyaguru followed by the healing mantra, recited for the healing of all beings.'
      },
      {
        id: 'medicine-buddha',
        title: 'Medicine Buddha Mantra',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit · repeated',
        loop: true,
        phrases: [
          { t: 'तद्यथा ॐ भैषज्ये भैषज्ये महाभैषज्ये राज समुद्गते स्वाहा', s: 'Tadyathā: Oṃ bhaiṣajye bhaiṣajye mahābhaiṣajye rāja samudgate svāhā', e: 'Thus: may all beings be healed, the Medicine Buddha mantra of healing and liberation.' },
          { t: 'तद्यथा ॐ भैषज्ये भैषज्ये महाभैषज्ये राज समुद्गते स्वाहा', s: 'Tadyathā: Oṃ bhaiṣajye bhaiṣajye mahābhaiṣajye rāja samudgate svāhā', e: 'Thus: may all beings be healed, the Medicine Buddha mantra of healing and liberation.' },
          { t: 'तद्यथा ॐ भैषज्ये भैषज्ये महाभैषज्ये राज समुद्गते स्वाहा', s: 'Tadyathā: Oṃ bhaiṣajye bhaiṣajye mahābhaiṣajye rāja samudgate svāhā', e: 'Thus: may all beings be healed, the Medicine Buddha mantra of healing and liberation.' }
        ],
        translation: 'The Sanskrit mantra of the Medicine Buddha (Bhaiṣajyaguru), recited to heal body, speech, and mind, for oneself and for all beings.'
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
      },
      {
        id: 'ksitigarbha-name',
        title: 'Namo Kṣitigarbha Bodhisattva',
        lang: 'en',
        langLabel: 'English · repeated',
        loop: true,
        phrases: [
          { t: 'Namo Ksitigarbha Bodhisattva', s: 'Namo Ksitigarbha Bodhisattva', e: 'Homage to Ksitigarbha Bodhisattva, the one who vows to save all beings.' },
          { t: 'Namo Ksitigarbha Bodhisattva', s: 'Namo Ksitigarbha Bodhisattva', e: 'Homage to Ksitigarbha Bodhisattva, the one who vows to save all beings.' },
          { t: 'Namo Ksitigarbha Bodhisattva', s: 'Namo Ksitigarbha Bodhisattva', e: 'Homage to Ksitigarbha Bodhisattva, the one who vows to save all beings.' }
        ],
        translation: 'The name-repetition of Ksitigarbha, the earth-vow bodhisattva, recited with single-pointed devotion.'
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
        id: 'shakyamuni',
        title: 'Shākyamuni Mantra',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit · repeated',
        loop: true,
        phrases: [
          { t: 'ॐ मुनि मुनि महामुनि शाक्यमुनिये स्वाहा', s: 'Om muni muni mahāmuni śākyamuniye svāhā', e: 'Homage to Shakyamuni, the sage of the Shakyas.' },
          { t: 'ॐ मुनि मुनि महामुनि शाक्यमुनिये स्वाहा', s: 'Om muni muni mahāmuni śākyamuniye svāhā', e: 'Homage to Shakyamuni, the sage of the Shakyas.' },
          { t: 'ॐ मुनि मुनि महामुनि शाक्यमुनिये स्वाहा', s: 'Om muni muni mahāmuni śākyamuniye svāhā', e: 'Homage to Shakyamuni, the sage of the Shakyas.' }
        ],
        translation: 'The mantra of the historical Buddha, recited to awaken the sage within.'
      },
      {
        id: 'bodhisattva-vow',
        title: 'The Bodhisattva Vow',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Sentient beings are numberless; I vow to save them all.' },
          { t: 'Delusions are inexhaustible; I vow to end them all.' },
          { t: 'Dharma gates are boundless; I vow to enter them all.' },
          { t: 'The Buddha\u2019s way is unsurpassable; I vow to realize it.' }
        ],
        translation: 'The four great vows of the bodhisattva, the promise to awaken together with every being.'
      },
      {
        id: 'great-compassion',
        title: 'The Great Compassion Dhāraṇī',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit',
        phrases: [
          { t: 'नमो रत्न त्रयाय', s: 'Namo ratna trayāya', e: 'Homage to the Three Jewels.' },
          { t: 'नमो आर्यावलोकितेश्वराय बोधिसत्त्वाय महासत्त्वाय महाकारुणिकाय', s: 'Namo āryāvalokiteśvarāya bodhisattvāya mahāsattvāya mahākāruṇikāya', e: 'Homage to Avalokitesvara, the great bodhisattva of great compassion.' },
          { t: 'तद्यथा ॐ तार तार तिरि तिरि तुरु तुरु', s: 'Tadyathā: Om tāra tāra tiri tiri turu turu', e: 'Thus: Om tara tara, tiri tiri, turu turu.' },
          { t: 'सर सर सिरि सिरि सुरु सुरु बोधिय बोधय मैत्रिय नीलकण्ठ दर्शनेन प्रह्लादय मनः स्वाहा', s: 'Sara sara siri siri suru suru, bodhiya bodhaya maitriya Nīlakaṇṭha, darśanena prahlādaya manaḥ svāhā', e: 'Awaken, awaken, may the sight of the Blue-Necked One gladden the heart, so be it.' }
        ],
        translation: 'The short Nīlakaṇṭha Dhāraṇī, the great compassion of Avalokitesvara, protector of all who call on it.'
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
        translation: 'The opening vow of Buddhist practice, returning home to awakening, truth, and companionship.'
      },
      {
        id: 'sarana',
        title: 'The Triple Refuge',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit · repeated',
        loop: true,
        phrases: [
          { t: 'बुद्धं शरणं गच्छामि', s: 'Buddhaṃ śaraṇaṃ gacchāmi', e: 'I go for refuge to the Buddha.' },
          { t: 'धर्मं शरणं गच्छामि', s: 'Dharmaṃ śaraṇaṃ gacchāmi', e: 'I go for refuge to the Dharma.' },
          { t: 'संघं शरणं गच्छामि', s: 'Saṃghaṃ śaraṇaṃ gacchāmi', e: 'I go for refuge to the Sangha.' }
        ],
        translation: 'The ancient triple refuge of the Buddha, returning home to awakening, truth, and fellowship.'
      },
      {
        id: 'metta',
        title: 'The Words of Loving-Kindness',
        lang: 'pi',
        langLabel: 'Pāli · repeated',
        loop: true,
        phrases: [
          { t: 'Sabbe sattā bhavantu sukhitattā', s: 'Sabbe sattā bhavantu sukhitattā', e: 'May all beings be happy and at ease.' },
          { t: 'Sabbe sattā arogā hontu', s: 'Sabbe sattā arogā hontu', e: 'May all beings be healthy and whole.' },
          { t: 'Sabbe sattā sukhitā hontu', s: 'Sabbe sattā sukhitā hontu', e: 'May all beings be truly happy.' },
          { t: 'Sabbe sattā khemā hontu', s: 'Sabbe sattā khemā hontu', e: 'May all beings be safe from harm.' },
          { t: 'Sabbe sattā bhadrāni passantu', s: 'Sabbe sattā bhadrāni passantu', e: 'May all beings see what is good and auspicious.' }
        ],
        translation: 'The Buddhaʼs teaching on loving-kindness, a wish repeated for every being, without exception.'
      },
      {
        id: 'usnisa-vijaya',
        title: 'Uṣṇīṣa Vijayā Dhāraṇī',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit',
        phrases: [
          { t: 'ॐ अमृतायुर्दडे स्वाहा', s: 'Om amṛtāyurdaḍe svāhā', e: 'May we be blessed with long, radiant life.' },
          { t: 'ॐ ध्रूं स्वाहा ॐ अमृतायुर्दडे स्वाहा', s: 'Om dhrūṃ svāhā, Om amṛtāyurdaḍe svāhā', e: 'The dharani of the Victorious One, dispeller of obstacles.' }
        ],
        translation: 'The Uṣṇīṣa Vijayā dhāraṇī of Namgyalma, recited to purify and lengthen life and to open the path beyond death.'
      },
      {
        id: 'usnisa-vijaya-long',
        title: 'Uṣṇīṣa Vijayā Dhāraṇī · The Long Chant',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit',
        phrases: [
          { t: 'नमो भगवते त्रैलोक्य प्रतिविशिष्टाय बुद्धाय भगवते', s: 'Namo bhagavate trailokya prativiśiṣṭāya buddhāya bhagavate', e: 'Homage to the Blessed Buddha, exalted above the three worlds.' },
          { t: 'तद्यथा ॐ विशोधय विशोधय समसम समन्त अवभास स्फरण', s: 'Tadyathā: Oṃ viśodhaya viśodhaya samasama samanta avabhāsa spharaṇa', e: 'Thus: Oṃ, purify, purify; radiant and all-pervading.' },
          { t: 'गति गहन स्वभाव विशुद्धे अभिषिञ्चतु मां', s: 'Gati gahana svabhāva viśuddhe abhiṣiñcatu māṃ', e: 'Pure in the nature of every path, consecrate me.' },
          { t: 'सुगत वर वचन अमृत अभिषेके महामन्त्र पाने', s: 'Sugata vara vacana amṛta abhiṣeke mahāmantra pāne', e: 'With the Sugata\u2019s supreme word, the ambrosia of consecration, O great-mantra bearer.' },
          { t: 'आहर आहर आयुः सन्धारणि शोधय शोधय गगन विशुद्धे', s: 'Āhara āhara āyuḥ sandhāraṇi śodhaya śodhaya gagana viśuddhe', e: 'Bring, bring, sustainer of life; purify, purify, pure as the sky.' },
          { t: 'उष्णीष विजय विशुद्धे सहस्ररश्मि सञ्चोदिते', s: 'Uṣṇīṣa vijaya viśuddhe sahasraraśmi sañcodite', e: 'Pure in the victorious crown, impelled by a thousand rays.' },
          { t: 'सर्व तथागत अवलोकन षट्पारमिता परिपूरणि', s: 'Sarva tathāgata avalokana ṣaṭpāramitā paripūraṇi', e: 'The seeing of all Tathāgatas, fulfiller of the six perfections.' },
          { t: 'सर्व तथागत मति दशभूमि प्रतिष्ठिते', s: 'Sarva tathāgata mati daśabhūmi pratiṣṭhite', e: 'The wisdom of all Tathāgatas, established in the ten stages.' },
          { t: 'सर्व तथागत हृदय अधिष्ठान अधिष्ठित महामुद्रे', s: 'Sarva tathāgata hṛdaya adhiṣṭhāna adhiṣṭhita mahāmudre', e: 'O great seal blessed by the heart-blessing of all Tathāgatas.' },
          { t: 'वज्रकाय सहरण विशुद्धे सर्व आवरण अपाय दुर्गति परिविशुद्धे', s: 'Vajrakāya saharaṇa viśuddhe sarva āvaraṇa apāya durgati pariviśuddhe', e: 'Pure vajra-body, purifier of all obstructions, miseries, and evil rebirths.' },
          { t: 'प्रतिनिर्वर्तय आयुः शुद्धे समय अधिष्ठिते', s: 'Pratinirvartaya āyuḥ śuddhe samaya adhiṣṭhite', e: 'Turn back the end of life, pure one, blessed in the pledge.' },
          { t: 'मणि मणि महामणि तथाता भूत कोटि परिशुद्धे', s: 'Maṇi maṇi mahāmaṇi tathātā bhūta koṭi pariśuddhe', e: 'Jewel, jewel, great jewel, pure as the boundlessness of reality.' },
          { t: 'विस्फुट बुद्धि शुद्धे जय जय विजय विजय स्मर स्मर', s: 'Visphuṭa buddhi śuddhe jaya jaya vijaya vijaya smara smara', e: 'Radiant pure wisdom, victory, victory; triumph, triumph; remember, remember.' },
          { t: 'सर्व बुद्ध अधिष्ठित शुद्धे वज्रे वज्र गर्भे', s: 'Sarva buddha adhiṣṭhita śuddhe vajre vajra garbhe', e: 'Blessed by all Buddhas, pure one, O vajra, O vajra womb.' },
          { t: 'वज्रं भवतु मम शरीरं सर्व सत्त्वानां च काय परिविशुद्धे', s: 'Vajraṃ bhavatu mama śarīraṁ sarva sattvānāṁ ca kāya pariviśuddhe', e: 'May my body become vajra, purifier of the bodies of all beings.' },
          { t: 'सर्व गति परिशुद्धे सर्व तथागताश्च मे सम आश्वासयन्तु', s: 'Sarva gati pariśuddhe sarva tathāgatāśca me sama āśvāsayantu', e: 'Purifier of all realms, may all Tathāgatas gladden me together.' },
          { t: 'सर्व तथागत सम आश्वास अधिष्ठिते बुध्य बुध्य विबुध्य विबुध्य', s: 'Sarva tathāgata sama āśvāsa adhiṣṭhite budhya budhya vibudhya vibudhya', e: 'Blessed by the Tathāgatas\u2019 common gladdening, awaken, awaken; awaken fully, awaken fully.' },
          { t: 'बोधय बोधय विबोधय विबोधय समन्त परिशुद्धे', s: 'Bodhaya bodhaya vibodhaya vibodhaya samanta pariśuddhe', e: 'Awaken others, awaken others; awaken them fully, all-purifying one.' },
          { t: 'सर्व तथागत हृदय अधिष्ठान अधिष्ठित महामुद्रे स्वाहा', s: 'Sarva tathāgata hṛdaya adhiṣṭhāna adhiṣṭhita mahāmudre svāhā', e: 'O great seal blessed by the heart-blessing of all Tathāgatas, so be it.' }
        ],
        translation: 'The full Uṣṇīṣa Vijayā dhāraṇī, the crown of long-life dhāraṇīs, chanted to purify, protect, and turn the tide of life toward awakening.'
      },
      {
        id: 'vajrasattva',
        title: 'Vajrasattva Mantra',
        lang: 'sa',
        langLabel: 'संस्कृतम् · Sanskrit · repeated',
        loop: true,
        phrases: [
          { t: 'ॐ वज्रसत्त्व हूं', s: 'Om vajrasattva hūṃ', e: 'The essence of Vajrasattva, purification and confession.' },
          { t: 'ॐ वज्रसत्त्व हूं', s: 'Om vajrasattva hūṃ', e: 'The essence of Vajrasattva, purification and confession.' },
          { t: 'ॐ वज्रसत्त्व हूं', s: 'Om vajrasattva hūṃ', e: 'The essence of Vajrasattva, purification and confession.' }
        ],
        translation: 'The short Vajrasattva mantra, the heart of the hundred-syllable purification practice.'
      },
      {
        id: 'metta-sutta',
        title: 'The Words of Loving-Kindness',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'May all beings be happy and secure;' },
          { t: 'may they be glad and safe.' },
          { t: 'Just as a mother protects her only child' },
          { t: 'with her very life,' },
          { t: 'so let boundless love be held for all beings —' },
          { t: 'above, below, and all around, without limit.' },
          { t: 'May we dwell with a heart that is wide and free,' },
          { t: 'sharing goodwill with all the world.' }
        ],
        translation: 'The Buddha\u2019s discourse on loving-kindness, the wish that all beings, without exception, be well.'
      },
      {
        id: 'namo-tassa',
        title: 'Namo Tassa',
        lang: 'pi',
        langLabel: 'पालि · Pali · repeated',
        loop: true,
        phrases: [
          { t: 'नमो तस्स भगवतो अरहतो सम्मासम्बुद्धस्स', s: 'Namo tassa bhagavato arahato sammāsambuddhassa', e: 'Homage to the Blessed One, the worthy one, the fully awakened.' },
          { t: 'नमो तस्स भगवतो अरहतो सम्मासम्बुद्धस्स', s: 'Namo tassa bhagavato arahato sammāsambuddhassa', e: 'Homage to the Blessed One, the worthy one, the fully awakened.' }
        ],
        translation: 'The ancient homage recited before the Buddha\u2019s teachings, a bow of gratitude for the awakening path.'
      },
      {
        id: '21-taras',
        title: 'The Twenty-One Taras',
        lang: 'bo',
        langLabel: 'བོད་སྐད · Tibetan · repeated',
        loop: true,
        phrases: [
          { t: 'ཨོཾ་ཇེ་ཙུན་དཔལ་མོ་སྒྲོལ་མ་ལ་ཕྱག་འཚལ།', s: 'Oṃ Tāre Tuttāre Ture Svāhā', e: 'Homage to Tara, the swift liberator, embodiment of compassion and courage.' },
          { t: 'ཨོཾ་ཏཱ་རེ་ཏུཏྟཱ་རེ་ཏུ་རེ་སྭཱ་ཧཱ།', s: 'Oṃ Tāre Tuttāre Ture Svāhā', e: 'Oṃ, homage to the shining mother who rescues from fear and grants protection.' },
          { t: 'ཨོཾ་ཏཱ་རེ་ཏུཏྟཱ་རེ་ཏུ་རེ་སྭཱ་ཧཱ།', s: 'Oṃ Tāre Tuttāre Ture Svāhā', e: 'Oṃ, to the lady who quells obstacles and leads beings to the other shore.' },
          { t: 'ཨོཾ་ཏཱ་རེ་ཏུཏྟཱ་རེ་ཏུ་རེ་སྭཱ་ཧཱ།', s: 'Oṃ Tāre Tuttāre Ture Svāhā', e: 'Oṃ, the liberator of the twenty-one forms, who grants all blessings.' }
        ],
        translation: 'The homage to the Twenty-One Taras, the female Buddhas of swift compassionate action, called upon for fearlessness, protection, and the removal of obstacles.'
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
        translation: 'A secular prayer of thanks, to people, chance, and the plain good luck of being alive.'
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
        translation: 'A meditation on wonder, a quiet moment under the same stars everyone has always looked up to.'
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
        translation: 'A secular prayer of presence, one minute held for everyone we cannot reach.'
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
        translation: 'A shared intention from the humanist heart, the good we owe each other without any god required.'
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
        translation: 'A prayer for honest doubt, wonder without certainty, and goodness without a witness.'
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
        translation: 'A secular dawn meditation, walking into the day with open hands.'
      },
      {
        id: 'serenity',
        title: 'A Prayer of Serenity',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Let me accept the things I cannot change,' },
          { t: 'with grace and without resignation.' },
          { t: 'Let me find the courage to change what I can,' },
          { t: 'and the wisdom to know the difference.' },
          { t: 'And when I cannot, let me rest in the trying.' }
        ],
        translation: 'The beloved serenity sentiment, spoken without a deity, as a quiet acceptance of what is and a gentle push toward what can be.'
      },
      {
        id: 'humanist-pledge',
        title: 'A Humanist\u2019s Page',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'I give my allegiance to no flag above humanity.' },
          { t: 'I owe kindness to every living face I meet.' },
          { t: 'My purpose will be shared, not hoarded.' },
          { t: 'And when I am gone, let me be remembered' },
          { t: 'as someone who made the load lighter.' }
        ],
        translation: 'A page of faith in people, a pledge to kindness and shared purpose, honoring the best of humanist ethics.'
      },
      {
        id: 'impermanence',
        title: 'A Reflection on Impermanence',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Everything I hold will someday let go.' },
          { t: 'Everything I love will someday change.' },
          { t: 'Knowing this, let me hold more gently,' },
          { t: 'love more fully, and grieve without closing.' },
          { t: 'The river flows; I ride the water.' }
        ],
        translation: 'A meditation on the passing of all things, which turns not to fear but to tenderness, presence, and openness.'
      },
      {
        id: 'morning-resolution',
        title: 'A Morning Resolution',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Today I will not be ruled by my mood.' },
          { t: 'I will choose, again and again, to be useful.' },
          { t: 'I will meet one hard thing with patience,' },
          { t: 'and one stranger with warmth.' },
          { t: 'And I will forgive myself for the rest.' }
        ],
        translation: 'A secular morning vow: to choose character over mood, to serve, and to hold oneself without shame.'
      },
      {
        id: 'night-letting-go',
        title: 'At Night, Letting Go',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'The day is done, and I did what I could.' },
          { t: 'Now I release the undone things into the dark.' },
          { t: 'Tomorrow they may return, or they may not.' },
          { t: 'For now, I give myself permission to rest.' },
          { t: 'The world will wait for me until morning.' }
        ],
        translation: 'A nightly release of worry, an end-of-day surrender to rest, trusting the world to hold until we wake.'
      },
      {
        id: 'thin-place',
        title: 'A Thin Place',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Here, by this quiet, the veil grows thin' },
          { t: 'between the world of hurry and the world of meaning.' },
          { t: 'Let me stand a moment in that open doorway,' },
          { t: 'and feel how everything belongs to everything.' },
          { t: 'Then let me carry that belonging home.' }
        ],
        translation: 'A Celtic-inspired meditation on the thin places where the ordinary opens onto the sacred, felt without doctrine.'
      },
      {
        id: 'kindness-spreads',
        title: 'Kindness Spreads',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'What I do today ripples past my seeing.' },
          { t: 'A kindness may find its way to someone I will never meet.' },
          { t: 'A harsh word may echo further than I meant.' },
          { t: 'Let me be mindful of the ripples I release,' },
          { t: 'and cast only the ones I would want to receive.' }
        ],
        translation: 'A secular prayer of consequence, honoring how kindness and unkindness travel beyond our sight.'
      },
      {
        id: 'where-im-from',
        title: 'Where I\u2019m From',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'I am made of everyone who ever held me,' },
          { t: 'of every table I ever shared,' },
          { t: 'of ancestors I never met whose hands shaped mine.' },
          { t: 'Let me live in a way they would cheer for,' },
          { t: 'and leave a thread for the ones who come next.' }
        ],
        translation: 'A gratitude for origins — family, friends, and ancestors — that honors the living web each of us is woven from.'
      },
      {
        id: 'forgiveness-secular',
        title: 'A Secular Practice of Forgiveness',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'The hurt was real; I do not have to make it small.' },
          { t: 'But I can choose to stop carrying it every hour.' },
          { t: 'I release the burden, not the lesson,' },
          { t: 'for my own sake, so I can be lighter.' },
          { t: 'What I let go of, I let go of in peace.' }
        ],
        translation: 'A self-compassionate path to forgiveness, freeing oneself from the weight of grievance without denying the pain.'
      },
      {
        id: 'one-breath',
        title: 'One Breath at a Time',
        lang: 'en',
        langLabel: 'English · a breath-prayer, repeated',
        loop: true,
        phrases: [
          { t: 'In, I am here.' },
          { t: 'Out, I belong.' },
          { t: 'In, I am here.' },
          { t: 'Out, I belong.' }
        ],
        translation: 'A tiny breathing prayer for the frightened heart — presence and belonging, repeated until both feel true.'
      },
      {
        id: 'sonder',
        title: 'Sonder',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Every stranger I pass is the hero of their own story,' },
          { t: 'carrying loves, losses, and small victories I will never know.' },
          { t: 'Let me meet each one with the respect I\u2019d want for my own.' },
          { t: 'The world is full of hidden poems.' },
          { t: 'Let me not be the punctuation that ends one early.' }
        ],
        translation: 'A meditation on sonder — the realization that every life is as vivid and vast as our own, deserving of dignity.'
      },
      {
        id: 'earth-turn',
        title: 'The Earth Turn for You',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'When the night feels too long,' },
          { t: 'remember the Earth still turns toward morning.' },
          { t: 'It turned for your parents, and their parents,' },
          { t: 'and it will turn for you.' },
          { t: 'The light is on its way; it always is.' }
        ],
        translation: 'A comfort for dark hours, a reminder of the world\u2019s constant return to light that has never once failed.'
      },
      {
        id: 'enough',
        title: 'Enough',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'I do not have to be extraordinary to be worthy.' },
          { t: 'Bread on the table, a safe place to rest,' },
          { t: 'one person glad to see me —' },
          { t: 'this is enough to call a life good.' },
          { t: 'Let me guard this enoughness like a flame.' }
        ],
        translation: 'A remedy for the pressure to achieve — the quiet conviction that ordinary sufficiency is already a good life.'
      },
      {
        id: 'courage-then-gentleness',
        title: 'Courage, Then Gentleness',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Let me be brave enough to be tender.' },
          { t: 'Let me be strong enough to ask for help.' },
          { t: 'Let me be wise enough to change my mind.' },
          { t: 'For in a world that rewards toughness,' },
          { t: 'the bravest act is still to care.' }
        ],
        translation: 'A redefinition of strength — courage shown through tenderness, honesty, and the willingness to change.'
      },
      {
        id: 'for-the-grieving',
        title: 'For the Grieving',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Grief is love with nowhere to go.' },
          { t: 'It does not mean I am broken —' },
          { t: 'it means I cared enough to hurt.' },
          { t: 'Let me carry that one, small, slowly.' },
          { t: 'All love eventually carries weight,' },
          { t: 'and all weight is finally carried together.' }
        ],
        translation: 'Comfort for the bereaved: reframing grief as love that has lost its object, and reminding that no one carries it alone.'
      }
    ]
  },
  {
    id: 'chinese',
    name: 'Chinese Spirituality',
    emoji: '🐉',
    glow: 'rgba(255, 140, 95, 0.26)',
    lightColor: '#ff8a5c',
    tagline: 'Heaven, ancestors, and the spirits of home and land.',
    prayers: [
      {
        id: 'jing-tian',
        title: 'Jìng Tiān, Reverence for Heaven',
        lang: 'zh',
        langLabel: '中文 · Chinese',
        phrases: [
          { t: '皇天在上', s: 'Huángtiān zàishàng', e: 'O August Heaven above,' },
          { t: '敬天愛人', s: 'Jìng tiān ài rén', e: 'reverence for Heaven, love for all people,' },
          { t: '風調雨順，五穀豐登', s: 'Fēng tiáo yǔ shùn, wǔgǔ fēngdēng', e: 'may winds and rains come in season and the harvest ripen,' },
          { t: '國泰民安', s: 'Guó tài mín ān', e: 'may the nation be at peace and its people safe.' }
        ],
        translation: 'The oldest prayer of Chinese life, honouring Heaven, the source of all that is good.'
      },
      {
        id: 'home-altar',
        title: 'A Prayer at the Home Altar',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Let this small flame be a quiet meeting place' },
          { t: 'between Heaven above and this earthly home.' },
          { t: 'For the ancestors who gave me life,' },
          { t: 'and the spirits of this place who guard it,' },
          { t: 'let my gratitude rise like incense,' },
          { t: 'and my kindness reach like a blessing.' }
        ],
        translation: 'A reflection on the family altar, incense, memory, and the everyday sacredness of home.'
      },
      {
        id: 'ji-zu',
        title: 'Jì Zǔ, Remembering the Ancestors',
        lang: 'zh',
        langLabel: '中文 · Chinese',
        phrases: [
          { t: '列祖列宗', s: 'Lièzǔ lièzōng', e: 'Ancestors of many generations,' },
          { t: '慎終追遠', s: 'Shèn zhōng zhuī yuǎn', e: 'with reverence we remember our beginnings,' },
          { t: '飲水思源', s: 'Yǐn shuǐ sī yuán', e: 'when we drink water, we remember its source,' },
          { t: '福澤綿延', s: 'Fúzé miányán', e: 'may your blessings flow down to us still.' }
        ],
        translation: 'The ancestral rite of home, gratitude to those who came before, honoured at the family altar.'
      },
      {
        id: 'mazu',
        title: 'Māzǔ, Guardian of the Seas',
        lang: 'zh',
        langLabel: '中文 · Chinese',
        phrases: [
          { t: '天上聖母', s: 'Tiānshàng Shèngmǔ', e: 'Holy Mother of Heaven,' },
          { t: '慈悲護海', s: 'Cíbēi hù hǎi', e: 'compassionate guardian of the seas,' },
          { t: '風平浪靜', s: 'Fēng píng làng jìng', e: 'calm the winds and still the waves,' },
          { t: '平安歸來', s: 'Píng\u2019ān guīlái', e: 'and bring all who sail safely home.' }
        ],
        translation: 'A prayer to Mazu, the beloved goddess of the sea, protector of every fisherman and every voyage.'
      },
      {
        id: 'guanyin',
        title: 'Námó Guānshìyīn Púsà',
        lang: 'zh',
        langLabel: '中文 · Chinese · repeated',
        loop: true,
        phrases: [
          { t: '南無觀世音菩薩', s: 'Námó Guānshìyīn Púsà', e: 'Homage to Guanshiyin Bodhisattva,' },
          { t: '大慈大悲', s: 'Dà cí dà bēi', e: 'great in compassion and mercy,' },
          { t: '救苦救難', s: 'Jiù kǔ jiù nàn', e: 'rescuer from suffering and distress,' },
          { t: '有求必應', s: 'Yǒu qiú bì yìng', e: 'ever answering the sincere heart.' }
        ],
        translation: 'The beloved invocation of Guanyin, the bodhisattva of compassion at the very heart of Chinese devotion.'
      },
      {
        id: 'tudi-gong',
        title: 'Tǔdì Gōng, The Earth God',
        lang: 'zh',
        langLabel: '中文 · Chinese',
        phrases: [
          { t: '土地公公', s: 'Tǔdì Gōnggong', e: 'Grandfather Earth God,' },
          { t: '一方水土，一方神明', s: 'Yī fāng shuǐtǔ, yī fāng shénmíng', e: 'spirit of this very soil and water,' },
          { t: '保佑平安', s: 'Bǎoyòu píng\u2019ān', e: 'keep our home and our people safe,' },
          { t: '感恩在心', s: 'Gǎn\u2019ēn zài xīn', e: 'our gratitude lives in our hearts.' }
        ],
        translation: 'A prayer to Tudi Gong, the kindly Earth God of each village and home, protector of the land that feeds us.'
      },
      {
        id: 'zao-jun',
        title: 'Zào Jūn, The Kitchen God',
        lang: 'zh',
        langLabel: '中文 · Chinese',
        phrases: [
          { t: '灶君老爺', s: 'Zào Jūn Lǎoyé', e: 'Lord of the Kitchen,' },
          { t: '上天言好事', s: 'Shàng tiān yán hǎoshì', e: 'when you ascend to Heaven, speak well of us,' },
          { t: '下界保平安', s: 'Xià jiè bǎo píng\u2019ān', e: 'and return to keep our household safe,' },
          { t: '一家之主', s: 'Yī jiā zhī zhǔ', e: 'guardian of this home and family.' }
        ],
        translation: 'The annual sending-off of Zao Jun, who watches the family from the hearth and reports to Heaven.'
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
        id: 'chardi-kala',
        title: 'Chaṛhdī Kalā',
        lang: 'pa',
        langLabel: 'ਪੰਜਾਬੀ · Gurmukhi · repeated',
        loop: true,
        phrases: [
          { t: 'ਨਾਨਕ ਨਾਮ ਚੜ੍ਹਦੀ ਕਲਾ', s: 'Nānak nām chaṛhdī kalā', e: 'By the Name of Nanak, may we ever rise higher.' },
          { t: 'ਤੇਰੇ ਭਾਣੇ ਸਰਬੱਤ ਦਾ ਭਲਾ', s: 'Tere bhāṇe sarbatt dā bhalā', e: 'By Your will, may the good of all be done.' }
        ],
        translation: 'The Sikh declaration of hope, an ever-rising spirit, and the good of all under Godʼs will.'
      },
      {
        id: 'deh-shiva',
        title: 'Deh Shivā Bar Mohe',
        lang: 'pa',
        langLabel: 'ਪੰਜਾਬੀ · Gurmukhi',
        phrases: [
          { t: 'ਦੇਹ ਸਿਵਾ ਬਰ ਮੋਹਿ ਇਹੈ ਸ਼ੁਭ ਕਰਮਨ ਤੇ ਕਬਹੂੰ ਨ ਟਰੋਂ', s: 'Deh śivā bar mohi ehai, śubh karman te kabahū̃ na ṭarō̃', e: 'Grant me this boon, O Lord, that I never turn from good deeds.' },
          { t: 'ਨ ਡਰੋਂ ਅਰਿ ਸੋ ਜਬ ਜਾਇ ਤਰੋਂ', s: 'Na ḍarō̃ ari so jab jāi tarō̃', e: 'That I never fear the enemy when I go into battle.' },
          { t: 'ਨਿਸਚੈ ਕਰਿ ਅਪਨੀ ਜੀਤ ਕਰੋਂ', s: 'Niścai kari apnī jīt karō̃', e: 'And with firm resolve, I claim the victory.' },
          { t: 'ਆਰਜ ਕੀਰਤਿ ਲੈ ਮੈਂ ਗਹਾ ਸੁਧਰਮ ਕਹਾ ਹੈ ਭਜਨ ਅਰ ਖਟਾ', s: 'Āraj kīrati lai maiṁ gahā, sudharam kahā hai bhajan ar khaṭā', e: 'Let me live long to sing Your praises, and earn my keep through honest work.' }
        ],
        translation: 'A soldier-prayer of the Khalsa, courage, righteousness, and remembrance of the Name.'
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
        translation: 'The Sikh greeting of the Khalsa, remembrance and victory belonging to the One, repeated with every breath.'
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
        translation: 'The greeting and battle-cry of the Khalsa, courage born of the Eternal Truth.'
      },
      {
        id: 'anand',
        title: 'Tera Kiya, From Anand Sahib',
        lang: 'pa',
        langLabel: 'ਪੰਜਾਬੀ · Gurmukhi',
        phrases: [
          { t: 'ਤੇਰਾ ਕੀਤਾ ਜਾਤੋ ਨਾਹੀ', s: 'Tērā kītā jātō nāhī', e: 'The value of what You have given, I cannot know.' },
          { t: 'ਮਨੋ ਗੁਨ ਨਵ ਨਿਧ ਆਵੈ', s: 'Mino gun nav nidh āvai', e: 'No treasure could ever repay it.' },
          { t: 'ਤੇਰਾ ਮੀਤਾ ਸਭੁ ਕੋ', s: 'Tērā mītā sabhu ko', e: 'Everyone is Your friend.' },
          { t: 'ਸਭਨਾ ਦਾ ਸਾਹਿਬੁ ਸਭੁ ਕੋ', s: 'Sabhanā dā sāhib sabhu ko', e: 'And You are the Master of all.' }
        ],
        translation: 'A hymn of humble gratitude, for gifts we can never repay, given by a love without limit.'
      },
      {
        id: 'waheguru',
        title: 'Waheguru Simran',
        lang: 'pa',
        langLabel: 'ਪੰਜਾਬੀ · Gurmukhi · repeated',
        loop: true,
        phrases: [
          { t: 'ਵਾਹਿਗੁਰੂ', s: 'Waheguru', e: 'Wonderful Lord, the divine light beyond all knowing.' },
          { t: 'ਵਾਹਿਗੁਰੂ', s: 'Waheguru', e: 'Wonderful Lord, the divine light beyond all knowing.' },
          { t: 'ਵਾਹਿਗੁਰੂ', s: 'Waheguru', e: 'Wonderful Lord, the divine light beyond all knowing.' },
          { t: 'ਵਾਹਿਗੁਰੂ', s: 'Waheguru', e: 'Wonderful Lord, the divine light beyond all knowing.' }
        ],
        translation: 'The meditative repetition of the Name, remembrance of the One through every breath.'
      },
      {
        id: 'simran',
        title: 'Simran, Remembering the Name',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'The One Name fills the whole creation.' },
          { t: 'Singing it, one finds joy.' },
          { t: 'Let no thought of greed, fear, or doubt cloud the heart.' },
          { t: 'The divine light shines in every being.' },
          { t: 'Bowing to that light, may I live with humility and courage.' },
          { t: 'Waheguru, wonderful Lord — I remember You.' }
        ],
        translation: 'A meditation of the Name from the Guru\u2019s teaching, remembrance that carries the soul through every day.'
      },
      {
        id: 'sarbat-da-bhala',
        title: 'Sarbat da Bhala',
        lang: 'pa',
        langLabel: 'ਪੰਜਾਬੀ · Gurmukhi · repeated',
        loop: true,
        phrases: [
          { t: 'ਸਰਬਤ ਦਾ ਭਲਾ', s: 'Sarbat dā bhalā', e: 'May all beings prosper and be well.' },
          { t: 'ਸਰਬਤ ਦਾ ਭਲਾ', s: 'Sarbat dā bhalā', e: 'May all beings prosper and be well.' }
        ],
        translation: 'The closing wish of the Ardas, the prayer that everyone, everywhere, be blessed and at peace.'
      },
      {
        id: 'ardaas-thanks',
        title: 'A Thanksgiving Ardaas',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Waheguru, Wonderful Lord, we give You thanks' },
          { t: 'for this day, this breath, and this company.' },
          { t: 'Thank You for the food that reached our table' },
          { t: 'and the hands and the land that brought it.' },
          { t: 'Bless our loved ones, bless all beings,' },
          { t: 'and keep our hearts turned to You. Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh.' }
        ],
        translation: 'A thanksgiving offered in the spirit of the Ardas, gratitude for the day and goodwill for all.'
      },
      {
        id: 'nam-japna',
        title: 'Nām Japna, Meditate on the Name',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Wake early, and in the stillness remember the One Name.' },
          { t: 'Let the Name be on your lips and in your heart.' },
          { t: 'Through remembrance, the mind grows clear and the soul finds peace.' },
          { t: 'Walk through the world carrying that Name,' },
          { t: 'and let it shape every word you speak.' }
        ],
        translation: 'The first pillar of the Sikh path, the daily practice of meditating on the One Name.'
      },
      {
        id: 'kirat-karo',
        title: 'Kirat Karo, Earn by Honest Work',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Work with your hands, honestly and well.' },
          { t: 'Share what you earn with those in need.' },
          { t: 'Let your work be your worship,' },
          { t: 'done with joy and without deceit.' },
          { t: 'For the One who gives all work also gives the strength to do it.' }
        ],
        translation: 'The Sikh teaching of honest work and sharing, labour offered as a form of devotion.'
      },
      {
        id: 'sukhmani-peace',
        title: 'From the Sukhmani Sahib',
        lang: 'en',
        langLabel: 'English · from the Guru Granth Sahib',
        phrases: [
          { t: 'Those who remember the Name are at peace,' },
          { t: 'their minds clear as a still pool.' },
          { t: 'In remembrance, fear departs and the heart grows wide.' },
          { t: 'The Name is the boat across every storm.' },
          { t: 'Sing it, and be at peace. Waheguru.' }
        ],
        translation: 'A loose rendering of the Sukhmani Sahib\u2019s teaching that remembrance of the Name brings peace.'
      },
      {
        id: 'sat-nam',
        title: 'Sat Nām, Truth Is the Name',
        lang: 'pa',
        langLabel: 'ਪੰਜਾਬੀ · Gurmukhi · repeated',
        loop: true,
        phrases: [
          { t: 'ਸਤਿ ਨਾਮੁ', s: 'Sat nām', e: 'Truth is the Name.' },
          { t: 'ਸਤਿ ਨਾਮੁ', s: 'Sat nām', e: 'Truth is the Name.' }
        ],
        translation: 'The essence of the Mool Mantar, that the divine is truth itself, repeated as a meditation.'
      },
      {
        id: 'prema-nam',
        title: 'A Meditation of Love',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'The Name is sweet to those who love it.' },
          { t: 'Let me love the world as the Guru loved it,' },
          { t: 'seeing the divine light in every face.' },
          { t: 'Let kindness be my speech and service my joy,' },
          { t: 'and let the Name dwell in my heart always.' }
        ],
        translation: 'A meditation on love for the Name and for all beings, the heart of Sikh devotion.'
      },
      {
        id: 'japji-light',
        title: 'From the Japji Sahib',
        lang: 'en',
        langLabel: 'English · from the Guru Granth Sahib',
        phrases: [
          { t: 'As in the darkness of night a lamp illumines the way,' },
          { t: 'so the Guru\u2019s word illumines the mind.' },
          { t: 'Meditate on the One who made the universe,' },
          { t: 'and you will find your way through every darkness.' },
          { t: 'Nanak says: the One is with you always.' }
        ],
        translation: 'A loose rendering of the Japji Sahib\u2019s image of the Guru\u2019s word as a lamp in the dark.'
      },
      {
        id: 'guru-charan',
        title: 'Guru Charan, At the Guru\u2019s Feet',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'At the Guru\u2019s feet I sit, and my heart grows quiet.' },
          { t: 'From the Guru I learn to serve without pride,' },
          { t: 'to speak truth without cruelty,' },
          { t: 'and to give without counting the cost.' },
          { t: 'May I walk this way all my days. Waheguru.' }
        ],
        translation: 'A prayer of humility and service, learning the way of truth and love from the Guru.'
      },
      {
        id: 'hukam',
        title: 'Hukam, Accepting the Divine Will',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Whatever comes, let me receive it with a quiet heart.' },
          { t: 'The seasons turn, the rivers flow, and all things have their time.' },
          { t: 'Help me to work with joy in what is mine to do,' },
          { t: 'and to let go of what is not.' },
          { t: 'In acceptance is peace; in peace is strength.' }
        ],
        translation: 'A meditation on hukam, the divine order, learning to live in harmony with what is.'
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
        translation: 'The majestic closing hymn of the liturgy, God beyond time, and my soul held safe in His hand.'
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
        translation: 'A joyful closing hymn of the liturgy, praise turned into a call-and-response of gratitude.'
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
        translation: 'The first words a Jew speaks on waking, gratitude before anything else.'
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
        translation: 'A closing prayer for peace, for us, for everyone, and for all who pray it.'
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
        translation: 'A traditional Sabbath greeting sung to the angels who accompany a person home, a prayer of welcome and peace.'
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
        translation: 'The ancient blessing God gave the priests, spoken over the people, among the oldest words of peace.'
      },
      {
        id: 'shehecheyanu',
        title: 'Shehecheyanu',
        lang: 'he',
        langLabel: 'עברית · Hebrew',
        phrases: [
          { t: 'בָּרוּךְ אַתָּה אֲדֹנָי אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם', s: 'Baruch atah Adonai, Eloheinu melech haolam', e: 'Blessed are You, Lord our God, Ruler of the universe,' },
          { t: 'שֶׁהֶחֱיָנוּ וְקִיְּמָנוּ וְהִגִּיעָנוּ לַזְּמַן הַזֶּה', s: 'Shehecheyanu vekiyemanu vehigiyanu lazman hazeh', e: 'who has kept us alive, sustained us, and brought us to this season.' }
        ],
        translation: 'The blessing of new beginnings and glad occasions, gratitude that we are here to share this moment.'
      },
      {
        id: 'vahavta',
        title: 'V\u2019ahavta',
        lang: 'he',
        langLabel: 'עברית · Hebrew',
        phrases: [
          { t: 'וְאָהַבְתָּ אֵת יְהוָה אֱלֹהֶיךָ', s: 'Ve\u2019ahavta et Adonai Elohecha', e: 'And you shall love the Lord your God' },
          { t: 'בְּכָל־לְבָבְךָ וּבְכָל־נַפְשְׁךָ וּבְכָל־מְאֹדֶךָ', s: 'Bechol-levavcha uvechol-nafshecha uvechol-meodecha', e: 'with all your heart, with all your soul, and with all your might.' },
          { t: 'וְשִׁנַּנְתָּם לְבָנֶיךָ וְדִבַּרְתָּ בָּם', s: 'Veshinantam levanecha vedibarta bam', e: 'Teach these words to your children, and speak of them' },
          { t: 'בְּשִׁבְתְּךָ בְּבֵיתֶךָ וּבְלֶכְתְּךָ בַדֶּרֶךְ', s: 'Beshibtecha beveitecha uvelechtecha vaderech', e: 'when you sit in your house and when you walk on the way.' }
        ],
        translation: 'The heart of the Shema, the command to love with everything we are and to pass that love on.'
      },
      {
        id: 'hashkiveinu',
        title: 'Hashkiveinu, Lay Us Down in Peace',
        lang: 'he',
        langLabel: 'עברית · Hebrew',
        phrases: [
          { t: 'הַשְׁכִּיבֵנוּ אָבִינוּ לְשָׁלוֹם', s: 'Hashkiveinu Avinu leshalom', e: 'Lay us down in peace, our Father,' },
          { t: 'וְהַעֲמִידֵנוּ מַלְכֵּנוּ לְחַיִּים טוֹבִים', s: 'Veha\u2019amideinu Malkeinu lechayim tovim', e: 'and raise us up, our King, to a good life.' },
          { t: 'וּפְרֹשׂ עָלֵינוּ סֻכַּת שְׁלוֹמֶךָ', s: 'Ufros aleinu sukkat shlomecha', e: 'Spread over us the shelter of Your peace,' },
          { t: 'וְשָׁמְרֵנוּ מִכָּל דָּבָר רָע', s: 'Veshamreinu mikol davar ra', e: 'and guard us from all harm,' },
          { t: 'בָּרוּךְ אַתָּה אֲדֹנָי הַפּוֹרֵשׂ סֻכַּת שָׁלוֹם', s: 'Baruch atah Adonai, hapores sukkat shalom', e: 'Blessed are You, Lord, who spreads a shelter of peace.'
        },
        ],
        translation: 'The evening prayer for a peaceful rest, a plea for a night of calm and a morning of goodness.'
      },
      {
        id: 'psalm-133',
        title: 'Psalm 133, How Good and Pleasant',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'How good and pleasant it is' },
          { t: 'when kindred live together in unity!' },
          { t: 'It is like precious oil upon the head,' },
          { t: 'running down upon the beard of Aaron,' },
          { t: 'like the dew of Hermon falling on the mountains of Zion.' },
          { t: 'For there the Lord bestows his blessing, even life forevermore.' }
        ],
        translation: 'A psalm of harmony, celebrating the sweetness of people dwelling together in peace.'
      },
      {
        id: 'tehillim-150',
        title: 'Tehillim 150, Let Everything Praise',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Praise the Lord!' },
          { t: 'Praise God in his sanctuary; praise him in his mighty firmament.' },
          { t: 'Praise him with trumpet sound, with lute and harp,' },
          { t: 'with tambourine and dance, with strings and pipe.' },
          { t: 'Let everything that breathes praise the Lord. Praise the Lord!' }
        ],
        translation: 'The final psalm, a joyful burst of music and dance in which all of creation praises.'
      },
      {
        id: 'psalm-128',
        title: 'Psalm 128, Blessed Is the Household',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Blessed is everyone who reveres the Lord, who walks in his ways.' },
          { t: 'You shall eat the fruit of the labor of your hands; you shall be happy, and it shall go well with you.' },
          { t: 'Your wife shall be like a fruitful vine within your house,' },
          { t: 'your children like olive shoots around your table.' },
          { t: 'Thus shall the one be blessed who reveres the Lord.' }
        ],
        translation: 'A psalm of blessing on family and honest work, the happiness of a home that reveres goodness.'
      },
      {
        id: 'sim-shalom',
        title: 'Sim Shalom, Grant Peace',
        lang: 'he',
        langLabel: 'עברית · Hebrew',
        phrases: [
          { t: 'שִׂים שָׁלוֹם טוֹבָה וּבְרָכָה', s: 'Sim shalom, tovah uvrachah', e: 'Grant peace, goodness, and blessing,' },
          { t: 'חֵן וָחֶסֶד וְרַחֲמִים', s: 'Chen vachesed verachamim', e: 'grace, kindness, and compassion,' },
          { t: 'עָלֵינוּ וְעַל כָּל יִשְׂרָאֵל עַמֶּךָ', s: 'Aleinu ve\u2019al kol Yisrael amecha', e: 'upon us and upon all your people,' },
          { t: 'וּבָרְכֵנוּ אָבִינוּ כֻּלָּנוּ כְּאֶחָד בְּאוֹר פָּנֶיךָ', s: 'Uvarcheinu Avinu kulanu ke\u2019echad be\u2019or panecha', e: 'and bless us, our Father, all of us together, in the light of Your face.'
        },
        ],
        translation: 'A prayer for peace, blessing, and grace to rest upon all people, together as one.'
      },
      {
        id: 'aleinu',
        title: 'Aleinu, It Is Our Duty',
        lang: 'he',
        langLabel: 'עברית · Hebrew',
        phrases: [
          { t: 'עָלֵינוּ לְשַׁבֵּחַ לַאֲדוֹן הַכֹּל', s: 'Aleinu leshabeach la\u2019Adon hakol', e: 'It is our duty to praise the Master of all,' },
          { t: 'לָתֵת גְּדֻלָּה לְיוֹצֵר בְּרֵאשִׁית', s: 'Latet gedulah leyotzer bereishit', e: 'to give greatness to the One who formed the beginning,' },
          { t: 'שֶׁלֹּא עָשָׂנוּ כְּגוֹיֵי הָאֲרָצוֹת', s: 'Shelo asanu kegoyei haaratzot', e: 'who made us free and upright,' },
          { t: 'וְשֶׁלֹּא שָׂם חֶלְקֵנוּ כְּחֶלְקָם', s: 'Veshelo sam chelkeinu kechelkam', e: 'and set our portion with those who seek good.' }
        ],
        translation: 'A hymn of praise that opens with duty to God and closes with the hope of a world made whole.'
      },
      {
        id: 'baruch-haba',
        title: 'Baruch Haba',
        lang: 'he',
        langLabel: 'עברית · Hebrew · repeated',
        loop: true,
        phrases: [
          { t: 'בָּרוּךְ הַבָּא', s: 'Baruch haba', e: 'Blessed is the one who comes.' },
          { t: 'בָּרוּךְ הַבָּא בְּשֵׁם ה׳', s: 'Baruch haba beshem Adonai', e: 'Blessed is the one who comes in the name of the Lord.' }
        ],
        translation: 'A greeting of welcome and blessing, spoken joyfully to guests and on glad occasions.'
      },
      {
        id: 'tehillim-121',
        title: 'Tehillim 121, A Prayer of Safe-Keeping',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'I lift up my eyes to the hills. From where does my help come?' },
          { t: 'My help comes from the Lord, who made heaven and earth.' },
          { t: 'He who keeps you will not slumber; he who watches over you will not sleep.' },
          { t: 'The Lord will keep you from all harm; he will watch over your life.' },
          { t: 'The Lord will watch over your going out and your coming in, now and forever.' }
        ],
        translation: 'A psalm of trust and protection, the assurance that we are watched over through every journey.'
      },
      {
        id: 'ma-tovu',
        title: 'Ma Tovu, How Good',
        lang: 'he',
        langLabel: 'עברית · Hebrew',
        phrases: [
          { t: 'מַה טֹּבוּ אֹהָלֶיךָ יַעֲקֹב', s: 'Mah tovu ohalecha Yaakov', e: 'How good are your tents, O Jacob,' },
          { t: 'מִשְׁכְּנֹתֶיךָ יִשְׂרָאֵל', s: 'Mishkenotecha Yisrael', e: 'your dwelling places, O Israel.' },
          { t: 'וַאֲנִי בְּרֹב חַסְדְּךָ אָבוֹא בֵיתֶךָ', s: 'Va\u2019ani berov chasdecha avo veitecha', e: 'And I, through the abundance of Your love, will enter Your house,' },
          { t: 'אֶשְׁתַּחֲוֶה אֶל הֵיכַל קָדְשְׁךָ בְּיִרְאָתֶךָ', s: 'Eshtachaveh el heichal kodshecha beyiratecha', e: 'and bow toward Your holy dwelling with reverence.' }
        ],
        translation: 'A morning prayer of wonder at the goodness of home and the joy of drawing near to God.'
      },
      {
        id: 'tehillim-100',
        title: 'Tehillim 100, A Joyful Noise',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Make a joyful noise to the Lord, all the earth.' },
          { t: 'Serve the Lord with gladness; come into his presence with singing.' },
          { t: 'Know that the Lord is God. It is he who made us, and we are his.' },
          { t: 'We are his people, and the sheep of his pasture.' },
          { t: 'Enter his gates with thanksgiving, and his courts with praise.' },
          { t: 'For the Lord is good; his steadfast love endures forever.' }
        ],
        translation: 'A psalm of pure gladness, gratitude, and belonging, a call to come before God with joy.'
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
        translation: 'A meditation on wu wei, effortless action in harmony with the Dao.'
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
        translation: 'A famous Taoist teaching on moral living, the quiet law by which good deeds find their way home.'
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
        translation: 'The opening of the Dao De Jing, the mystery beyond words from which all things arise.'
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
        translation: 'The three treasures of the Dao De Jing, the quiet strengths that keep a life in harmony.'
      },
      {
        id: 'water-way',
        title: 'The Way of Water',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Nothing in the world is softer or more yielding than water.' },
          { t: 'Yet nothing is better at overcoming the hard and the rigid.' },
          { t: 'The weak overcomes the strong; the gentle overcomes the fierce.' },
          { t: 'Everyone knows this is so, yet few live by it.' },
          { t: 'Be like water: yielding, patient, and quietly strong.' }
        ],
        translation: 'From the Dao De Jing, the teaching that gentleness flows around every obstacle and still arrives.'
      },
      {
        id: 'dao-emptiness',
        title: 'The Use of Emptiness',
        lang: 'en',
        langLabel: 'English · from the Dao De Jing',
        phrases: [
          { t: 'Thirty spokes share one hub,' },
          { t: 'and it is the empty space that makes the wheel useful.' },
          { t: 'Clay is shaped into a vessel,' },
          { t: 'and it is the hollow within that makes it useful.' },
          { t: 'Doors and windows are cut to make a room,' },
          { t: 'and it is the emptiness that makes it a home.' },
          { t: 'What is, is for usefulness; what is not, is for its use.' }
        ],
        translation: 'From the Dao De Jing, the quiet teaching that emptiness and space are where the value lives.'
      },
      {
        id: 'dao-return',
        title: 'Returning Is the Movement',
        lang: 'en',
        langLabel: 'English · from the Dao De Jing',
        phrases: [
          { t: 'Empty the mind and fill the heart; quiet the senses and see clearly.' },
          { t: 'Returning is the movement of the Dao; yielding is the way of the Dao.' },
          { t: 'All things return to the root, and in returning they find stillness.' },
          { t: 'Stillness is how we become whole again.' },
          { t: 'Knowing this constancy is to be at peace.' }
        ],
        translation: 'From the Dao De Jing, the practice of stillness and return, the way we find our center again.'
      },
      {
        id: 'dao-contentment',
        title: 'Know When to Stop',
        lang: 'en',
        langLabel: 'English · from the Dao De Jing',
        phrases: [
          { t: 'Which is dearer, fame or life?' },
          { t: 'Which is more, health or wealth?' },
          { t: 'To know when you have enough is to be rich.' },
          { t: 'To stop before you are full is to endure long.' },
          { t: 'Keep to the simple, and you will have all you truly need.' }
        ],
        translation: 'From the Dao De Jing, the teaching of contentment, that knowing enough is true wealth.'
      },
      {
        id: 'dao-uncarved',
        title: 'Return to the Uncarved Block',
        lang: 'en',
        langLabel: 'English · from the Dao De Jing',
        phrases: [
          { t: 'Give up cleverness, and people benefit a hundredfold.' },
          { t: 'Give up selfishness, and people return to honesty.' },
          { t: 'Return to simplicity, and put aside desire.' },
          { t: 'The uncarved block is whole and unbroken.' },
          { t: 'Be like the uncarved block: natural, unforced, and quietly complete.' }
        ],
        translation: 'From the Dao De Jing, the call back to simplicity, before the world complicates us.'
      },
      {
        id: 'zhuangzi-free',
        title: 'Free and Easy Wandering',
        lang: 'en',
        langLabel: 'English · from the Zhuangzi',
        phrases: [
          { t: 'The great bird rides the wind for a journey of ten thousand miles.' },
          { t: 'The little sparrow hops from branch to branch,' },
          { t: 'and each is at ease in its own way.' },
          { t: 'Do not measure yourself by another\u2019s journey.' },
          { t: 'Wander freely; be content with your own season and your own sky.' }
        ],
        translation: 'From the Zhuangzi, a tale of contentment, that every being has its own natural freedom.'
      },
      {
        id: 'dao-nonaction',
        title: 'The Grace of Non-Action',
        lang: 'en',
        langLabel: 'English · from the Dao De Jing',
        phrases: [
          { t: 'Practice non-action, and nothing is left undone.' },
          { t: 'The sage does not force, and nothing is beyond reach.' },
          { t: 'The great tree grows from a tiny sprout.' },
          { t: 'The nine-story tower rises from a handful of earth.' },
          { t: 'Begin where you are; act gently; let things ripen in their own time.' }
        ],
        translation: 'From the Dao De Jing, the art of wu-wei, acting with the grain of things rather than against it.'
      },
      {
        id: 'daodejing-heaven',
        title: 'The Way of Heaven',
        lang: 'en',
        langLabel: 'English · from the Dao De Jing',
        phrases: [
          { t: 'The way of heaven is to benefit others and not harm.' },
          { t: 'The sage does not accumulate; the more she gives, the more she has.' },
          { t: 'The more he helps others, the richer he becomes.' },
          { t: 'Heaven\u2019s way is to give; the sage\u2019s way is to give without keeping.' }
        ],
        translation: 'From the Dao De Jing, the teaching that generosity is the nature of heaven and of a good life.'
      },
      {
        id: 'taoist-breathe',
        title: 'A Breath of Stillness',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Breathe in, and gather peace.' },
          { t: 'Breathe out, and let the day fall away.' },
          { t: 'Feel the slow river of breath within you.' },
          { t: 'You are not in a hurry; the Dao is not in a hurry.' },
          { t: 'Rest in this quiet, and be renewed.' }
        ],
        translation: 'A simple breathing meditation in the Taoist spirit, stillness gathered with every breath.'
      },
      {
        id: 'dao-simplicity-nature',
        title: 'The Dao, and Nature Follows',
        lang: 'en',
        langLabel: 'English · from the Dao De Jing',
        phrases: [
          { t: 'There is something formless and complete, born before heaven and earth.' },
          { t: 'I do not know its name; I call it the Dao.' },
          { t: 'The Dao follows its own nature; heaven follows the Dao;' },
          { t: 'earth follows heaven, and humanity follows earth.' },
          { t: 'When we follow our nature, we fall into place like rain finding the valley.' }
        ],
        translation: 'From the Dao De Jing, the image of the Dao as the source that all things follow naturally.'
      },
      {
        id: 'yin-yang-balance',
        title: 'A Meditation on Balance',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Light and shadow together make the day.' },
          { t: 'Rest and motion together make a life.' },
          { t: 'Do not cling to the bright and flee the dark;' },
          { t: 'each gives the other its meaning.' },
          { t: 'May I hold both gently, and walk the center path.' }
        ],
        translation: 'A meditation on yin and yang, the harmony found in welcoming both halves of every whole.'
      }
    ]
  },
  {
    id: 'confucianism',
    name: 'Confucianism',
    emoji: '🏮',
    glow: 'rgba(224, 90, 90, 0.26)',
    lightColor: '#e05a5a',
    tagline: 'Ren, ritual, and the harmony of all under heaven.',
    prayers: [
      {
        id: 'great-learning',
        title: 'The Great Learning, 大學',
        lang: 'zh',
        langLabel: '中文 · Chinese',
        phrases: [
          { t: '大學之道，在明明德，在親民，在止於至善。', s: 'Dàxué zhī dào, zài míng míngdé, zài qīnmín, zài zhǐ yú zhìshàn.', e: 'The way of the Great Learning is to illuminate bright virtue, to renew the people, and to rest in the highest good.' },
          { t: '知止而后有定，定而后能靜，靜而后能安。', s: 'Zhī zhǐ érhòu yǒu dìng, dìng érhòu néng jìng, jìng érhòu néng ān.', e: 'Knowing where to rest, one becomes settled; settled, one can be still; still, one can be at peace.' }
        ],
        translation: 'The opening of the Great Learning, a core Confucian text on self-cultivation as the root of harmony.'
      },
      {
        id: 'ren',
        title: 'A Meditation on Ren, 仁',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Let me be truly human-hearted today.' },
          { t: 'Let me see the other as myself,' },
          { t: 'and treat every meeting as a guest to honour.' },
          { t: 'Ritual without love is empty;' },
          { t: 'let my courtesy come from a full heart.' }
        ],
        translation: 'A reflection on ren, Confucian human-heartedness expressed through empathy, ritual, and care.'
      },
      {
        id: 'learning-joy',
        title: 'Learning Is a Joy, 學而時習之',
        lang: 'zh',
        langLabel: '中文 · Chinese',
        phrases: [
          { t: '學而時習之，不亦說乎？', s: 'Xué ér shí xí zhī, bù yì yuè hū?', e: 'To learn and practise it often, is that not a joy?' },
          { t: '有朋自遠方來，不亦樂乎？', s: 'Yǒu péng zì yuǎnfāng lái, bù yì lè hū?', e: 'To have friends come from afar, is that not a pleasure?' }
        ],
        translation: 'The opening of the Analects, learning, practice, and friendship as quiet joys of the good life.'
      },
      {
        id: 'golden-rule',
        title: 'The Golden Rule, 己所不欲',
        lang: 'zh',
        langLabel: '中文 · Chinese',
        phrases: [
          { t: '己所不欲，勿施於人。', s: 'Jǐ suǒ bù yù, wù shī yú rén.', e: 'Do not do to others what you would not have done to you.' },
          { t: '夫仁者，己欲立而立人，己欲達而達人。', s: 'Fū rén zhě, jǐ yù lì ér lì rén, jǐ yù dá ér dá rén.', e: 'The human-hearted: wishing to stand, they help others stand; wishing to succeed, they help others succeed.' }
        ],
        translation: 'The Confucian Golden Rule from the Analects, empathy as the very heart of ren.'
      },
      {
        id: 'sincerity',
        title: 'The Way of Sincerity',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Sincerity is the way of heaven,' },
          { t: 'and the cultivation of sincerity is the way of the human-hearted.' },
          { t: 'Through sincerity one comes to understand all things,' },
          { t: 'and through understanding, one becomes sincere.' },
          { t: 'Let me be genuine in heart, gentle in word, and faithful in deed.' }
        ],
        translation: 'From the Doctrine of the Mean, sincerity as the root of a life in harmony with heaven and others.'
      },
      {
        id: 'analects-friends',
        title: 'Delightful Friends',
        lang: 'en',
        langLabel: 'English · from the Analects',
        phrases: [
          { t: 'Is it not a joy to practice what you learn?' },
          { t: 'Is it not delightful to have friends come from afar?' },
          { t: 'To be trusted, yet not put out — is that not the mark of a noble person?' },
          { t: 'Let me be a warm friend and a ready learner all my days.' }
        ],
        translation: 'The opening of the Analects, a celebration of learning and of friendship that crosses distances.'
      },
      {
        id: 'analects-junzi',
        title: 'The Noble Person',
        lang: 'en',
        langLabel: 'English · from the Analects',
        phrases: [
          { t: 'The noble person is calm and serene;' },
          { t: 'the small person is always anxious.' },
          { t: 'The noble person thinks of what is right;' },
          { t: 'the small person thinks of what will pay.' },
          { t: 'Let me face the world with a settled heart and a sense of what is good.' }
        ],
        translation: 'From the Analects, the portrait of the junzi, serene, principled, and at ease.'
      },
      {
        id: 'mencius-goodness',
        title: 'The Heart That Cannot Bear Suffering',
        lang: 'en',
        langLabel: 'English · from Mencius',
        phrases: [
          { t: 'Everyone has a heart that cannot bear to see suffering.' },
          { t: 'Seeing a child about to fall into a well,' },
          { t: 'anyone would rush to help — not for reward, not for praise,' },
          { t: 'but because compassion is natural to every human heart.' },
          { t: 'Nurture this heart, and it grows into goodness for all.' }
        ],
        translation: 'From Mencius, the teaching that compassion is the seed of goodness in every person.'
      },
      {
        id: 'filial-xiao',
        title: 'A Prayer of Filial Love',
        lang: 'en',
        langLabel: 'English · from the Confucian tradition',
        phrases: [
          { t: 'Honor your father and your mother,' },
          { t: 'and those who raised you and taught you.' },
          { t: 'Their love was the first love you knew.' },
          { t: 'Let me repay it with care in their later years,' },
          { t: 'and pass that care on to the generations to come.' }
        ],
        translation: 'A prayer reflecting xiao, filial piety, the root of love that grows outward to all the world.'
      },
      {
        id: 'mean-balance',
        title: 'The Center of the Mean',
        lang: 'en',
        langLabel: 'English · from the Doctrine of the Mean',
        phrases: [
          { t: 'Before joy, anger, sorrow, and pleasure are expressed, it is called the center.' },
          { t: 'When they are expressed in due measure, it is called harmony.' },
          { t: 'The center is the root of all things; harmony is the way of the world.' },
          { t: 'Let me find the quiet center in myself,' },
          { t: 'and let all I do come forth in harmony.' }
        ],
        translation: 'From the Doctrine of the Mean, the practice of balance, the center from which harmony flows.'
      },
      {
        id: 'analects-ritual',
        title: 'Look, Listen, and Be Kind',
        lang: 'en',
        langLabel: 'English · from the Analects',
        phrases: [
          { t: 'Look at nothing contrary to what is fitting.' },
          { t: 'Listen to nothing contrary to what is fitting.' },
          { t: 'Speak nothing contrary to what is fitting.' },
          { t: 'Do nothing contrary to what is fitting.' },
          { t: 'In all things, let courtesy guard the heart.' }
        ],
        translation: 'From the Analects, the practice of courtesy as a way of protecting the good in every moment.'
      },
      {
        id: 'analects-knowledge',
        title: 'To Know What You Do Not Know',
        lang: 'en',
        langLabel: 'English · from the Analects',
        phrases: [
          { t: 'To say you know what you know,' },
          { t: 'and to know what you do not know —' },
          { t: 'that is true knowledge.' },
          { t: 'Let me learn eagerly from the wise,' },
          { t: 'and remain humble before what is still unknown.' }
        ],
        translation: 'From the Analects, the wisdom of honest ignorance, the foundation of all true learning.'
      },
      {
        id: 'analects-virtue',
        title: 'Virtue Is Never Lonely',
        lang: 'en',
        langLabel: 'English · from the Analects',
        phrases: [
          { t: 'Virtue is never solitary;' },
          { t: 'it always has neighbors.' },
          { t: 'Do good, and goodness finds its way home to you.' },
          { t: 'Be kind, and kindness gathers around.' },
          { t: 'Let me be a neighbor to every good thing.' }
        ],
        translation: 'From the Analects, the assurance that a life of virtue naturally draws good company.'
      },
      {
        id: 'confucius-study',
        title: 'A Humble Seeker',
        lang: 'en',
        langLabel: 'English · from the Analects',
        phrases: [
          { t: 'I was not born with knowledge;' },
          { t: 'I love the ancient teachings and work hard to follow them.' },
          { t: 'Learn as if you could never reach the end,' },
          { t: 'as if you were afraid of losing what you have gained.' },
          { t: 'The road of learning is a road without end, and it is a joy to walk.' }
        ],
        translation: 'From the Analects, the portrait of the humble, tireless seeker after wisdom.'
      },
      {
        id: 'analects-warmth',
        title: 'Warmth at Home, Gentleness Abroad',
        lang: 'en',
        langLabel: 'English · from the Analects',
        phrases: [
          { t: 'Let me be warm and reverent at home,' },
          { t: 'respectful and gentle with all I meet,' }
        ],
        translation: 'From the Analects, the simple daily practice of kindness in the home and courtesy in the world.'
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
        title: 'Ōharae, The Great Purification',
        lang: 'ja',
        langLabel: '日本語 · Japanese',
        phrases: [
          { t: '祓へ給へ、清め給へ', s: 'Harae tamae, kiyome tamae', e: 'Purify us, cleanse us.' },
          { t: '高天原に神留り坐す', s: 'Takama-ga-hara ni kamuzumari-masu', e: 'The kami who abide in the High Plain of Heaven,' },
          { t: '諸々の禍事・罪・穢れを', s: 'Moromoro no magagoto, tsumi, kegare o', e: 'take away every misfortune, fault, and defilement,' },
          { t: '祓へ給ひ清め給ふことを', s: 'Harae-tamai kiyome-tamau koto o', e: 'and purify them away.' }
        ],
        translation: 'The ancient rite of purification spoken at shrines, an offering of cleansing before the kami.'
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
        translation: 'A short norito of sincerity, a clean heart offered before the divine presence in all things.'
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
        translation: 'A simple morning offering of gratitude to the Sun Goddess, the source of light and life.'
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
        translation: 'A reflection on the Shinto sense of the sacred, the kami present in all of nature.'
      },
      {
        id: 'kannagara',
        title: 'Kannagara, With the Kami',
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
        translation: 'A reflection on kannagara, the Shinto way of living in harmony with the divine that pervades the world.'
      },
      {
        id: 'arigato-kami',
        title: 'A Thank-You to the Kami',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'Thank you for the morning light,' },
          { t: 'thank you for the food upon the table,' },
          { t: 'thank you for the hands that prepared it.' },
          { t: 'Thank you for the family and friends who walk beside me,' },
          { t: 'and for the peace that rests upon this home.' },
          { t: 'May I give back to the world as much as I have received.' }
        ],
        translation: 'A simple gratitude prayer offered before the kami of home, family, and the day.'
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
        translation: 'The supreme Jain mantra of veneration, bowing to those who have freed themselves, and to all seekers on the path.'
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
        translation: 'The great Jain declaration, harmlessness toward every living being as the root of all virtue.'
      },
      {
        id: 'khamavani',
        title: 'Khamāvaṇī, The Forgiveness Prayer',
        lang: 'pra',
        langLabel: 'प्राकृत · Prakrit',
        phrases: [
          { t: 'खमेमि सव्वे जीवा', s: 'Khamemi savve jīvā', e: 'I forgive all living beings.' },
          { t: 'सव्वे जीवा खमंतु मे', s: 'Savve jīvā khamantu me', e: 'May all living beings forgive me.' },
          { t: 'मित्ति मे सव्व भूएसु', s: 'Mitti me savva bhūesu', e: 'I am a friend to all beings.' },
          { t: 'वेरं मझं न केणइ', s: 'Veraṁ majjhaṁ na keṇai', e: 'I hold enmity with no one.' }
        ],
        translation: 'The Jain prayer of reconciliation, spoken at the close of the holy days, forgiveness given and received.'
      },
      {
        id: 'pratikraman',
        title: 'Pratikramaṇa, Returning to the Path',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'I bow to the way of ahimsa, and turn back from harm.' },
          { t: 'For any hurt I have caused by thought, word, or deed,' },
          { t: 'I ask forgiveness of all living beings.' },
          { t: 'And I forgive all who have wronged me.' },
          { t: 'Let me begin again, gently, with every being.' }
        ],
        translation: 'A reflection on pratikramana, the Jain practice of confession and turning back to the path of non-violence.'
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
        translation: 'A reflection on the five great vows of Mahavira, non-violence, truth, non-stealing, chastity, and non-attachment.'
      },
      {
        id: 'maitri-bhavana',
        title: 'Maitrī, Friendship with All Beings',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'I am a friend to all that lives —' },
          { t: 'to those I know and those I have never met,' },
          { t: 'to the small and the great, the near and the far.' },
          { t: 'May no one fear me, and may I fear no one.' },
          { t: 'Let my life bring ease to every being it touches.' }
        ],
        translation: 'The Jain ideal of maitri, universal friendship, a heart held open to every living thing.'
      }
    ]
  },
  {
    id: 'african',
    name: 'African Traditions',
    emoji: '🐘',
    glow: 'rgba(224, 164, 88, 0.26)',
    lightColor: '#e0a458',
    tagline: 'Ancestors, the Great Spirit, and the living land.',
    prayers: [
      {
        id: 'ase',
        title: 'Àṣẹ, So Be It',
        lang: 'yo',
        langLabel: 'Yorùbá · repeated',
        loop: true,
        phrases: [
          { t: 'Olódùmarè, Ẹlẹ́dàá', s: 'Olódùmarè, Ẹlẹ́dàá', e: 'Olodumare, the Creator of all.' },
          { t: 'Àṣẹ.', s: 'Àṣẹ.', e: 'So be it.' },
          { t: 'Àṣẹ.', s: 'Àṣẹ.', e: 'So be it.' },
          { t: 'Àṣẹ.', s: 'Àṣẹ.', e: 'So be it.' }
        ],
        translation: 'The Yoruba affirmation of the power of spoken prayer, each word spoken with the force of Àṣẹ, "so be it."'
      },
      {
        id: 'ancestors',
        title: 'A Prayer for the Ancestors',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'We call on those who walked before us,' },
          { t: 'the elders of our blood and our land.' },
          { t: 'Guide our hands to be gentle' },
          { t: 'and our words to be true.' },
          { t: 'May we remember where we come from,' },
          { t: 'and carry that memory forward, kindly. Àṣẹ.' }
        ],
        translation: 'A prayer of remembrance for the ancestors, honoured across African traditions, the living carried by the living.'
      },
      {
        id: 'odomankoma',
        title: 'Odomankoma, The Creator',
        lang: 'ak',
        langLabel: 'Akan · Twi',
        phrases: [
          { t: 'Odomankoma', s: 'Odomankoma', e: 'The Creator of all things.' },
          { t: 'Nyame', s: 'Nyame', e: 'God, who is above.' },
          { t: 'Yɛda wo ase', s: 'Yɛda wo ase', e: 'We give You thanks.' }
        ],
        translation: 'An Akan prayer of thanksgiving to Odomankoma, the Creator, gratitude spoken before all else.'
      },
      {
        id: 'umvelinqangi',
        title: 'Umvelinqangi, The Great Spirit',
        lang: 'zu',
        langLabel: 'isiZulu · repeated',
        loop: true,
        phrases: [
          { t: 'Umvelinqangi', s: 'Umvelinqangi', e: 'The Great Spirit, present from the beginning.' },
          { t: 'Umvelinqangi', s: 'Umvelinqangi', e: 'The Great Spirit, present from the beginning.' },
          { t: 'Umvelinqangi', s: 'Umvelinqangi', e: 'The Great Spirit, present from the beginning.' }
        ],
        translation: 'A Zulu name for the Great Spirit, repeated as a meditation on the divine that was before all things.'
      },
      {
        id: 'ubuntu',
        title: 'Ubuntu, I Am Because We Are',
        lang: 'en',
        langLabel: 'English · from the Bantu traditions',
        phrases: [
          { t: 'A person is a person through other persons.' },
          { t: 'I am because we are; we are because I am.' },
          { t: 'Let me see the divine in every face,' },
          { t: 'and be my brother\u2019s and my sister\u2019s keeper.' },
          { t: 'In sharing, we grow; in kindness, we are whole. Ubuntu.' }
        ],
        translation: 'The great African teaching of ubuntu, our shared humanity — that no one flourishes alone.'
      },
      {
        id: 'zulu-thanks',
        title: 'Ukubonga, A Zulu Thanksgiving',
        lang: 'zu',
        langLabel: 'isiZulu',
        phrases: [
          { t: 'Ngiyabonga Nkulunkulu', s: 'Ngiyabonga Nkulunkulu', e: 'I give thanks to the Great Spirit.' },
          { t: 'Ngobuhle bangaphezulu', s: 'Ngobuhle bangaphezulu', e: 'For the goodness that comes from above,' },
          { t: 'Ngokuthula kwenhliziyo', s: 'Ngokuthula kwenhliziyo', e: 'for the peace of a quiet heart,' },
          { t: 'Ngezibusiso zonke', s: 'Ngezibusiso zonke', e: 'and for every blessing that surrounds me.' }
        ],
        translation: 'A Zulu prayer of thanksgiving to Nkulunkulu, gratitude for goodness, peace, and every blessing.'
      },
      {
        id: 'akan-nyame',
        title: 'Nyame, The Sky God',
        lang: 'ak',
        langLabel: 'Akan · Twi',
        phrases: [
          { t: 'Nyame', s: 'Nyame', e: 'God above, the one who holds the sky.' },
          { t: 'Wose wode ns\u025b\u025b a na fa', s: 'W\u0254s\u025b w\u0254de ns\u025b\u025b a na fa', e: 'If you do not take something, nothing is gained.' },
          { t: 'Y\u025bda wo ase', s: 'Y\u025bda wo ase', e: 'We give You thanks.' },
          { t: 'Ma y\u025bnnya asomdwee', s: 'Ma y\u025bnnya asomdwee', e: 'Grant us peace and wellbeing.' }
        ],
        translation: 'An Akan prayer to Nyame, the great sky God, thanking the source of all gifts and asking for peace.'
      },
      {
        id: 'igbo-chi',
        title: 'A Prayer to One\u2019s Chi',
        lang: 'ig',
        langLabel: 'Igbo',
        phrases: [
          { t: 'Chi m, the spirit that walks with me,' },
          { t: 'stay close and guide my path.' },
          { t: 'When I stumble, lift me gently.' },
          { t: 'When I am lost, show me home.' },
          { t: 'In all things, let me walk with a good heart. \u00cdke m.' }
        ],
        translation: 'An Igbo prayer to one\u2019s chi, the personal guardian spirit, asking for guidance and a good heart.'
      },
      {
        id: 'masai-blessing',
        title: 'A Maasai Blessing',
        lang: 'en',
        langLabel: 'English · from the Maasai people',
        phrases: [
          { t: 'May God give you rain,' },
          { t: 'and grass for your cattle,' },
          { t: 'and children to carry your name.' },
          { t: 'May you walk in health and peace,' },
          { t: 'and may the morning find you strong. Enkai akee.' }
        ],
        translation: 'A Maasai blessing of rain, abundance, and family, offered with love for a long and peaceful life.'
      },
      {
        id: 'yoruba-morning',
        title: 'A Yoruba Morning Greeting',
        lang: 'en',
        langLabel: 'English · from the Yoruba people',
        phrases: [
          { t: 'May the new day meet you gently,' },
          { t: 'with blessings on your head and peace in your home.' },
          { t: 'May the sun rise on your joy,' },
          { t: 'and the road ahead be smooth.' },
          { t: 'As we greet the dawn together, \u00c0\u1e63\u1eb9. So be it.' }
        ],
        translation: 'A Yoruba greeting for the new day, wishing blessings, joy, and a smooth road to all.'
      }
    ]
  },
  {
    id: 'earthway',
    name: 'Earthway · Indigenous',
    emoji: '🌿',
    glow: 'rgba(120, 200, 140, 0.24)',
    lightColor: '#7fd488',
    tagline: 'All my relations, gratitude to the living world.',
    prayers: [
      {
        id: 'mitakuye-oyasin',
        title: 'Mitákuye Oyásʼiŋ, All My Relations',
        lang: 'lkt',
        langLabel: 'Lakȟótiyapi · Lakota · repeated',
        loop: true,
        phrases: [
          { t: 'Mitákuye Oyásʼiŋ', s: 'Mitákuye Oyásʼiŋ', e: 'All my relations, we are all connected.' },
          { t: 'Mitákuye Oyásʼiŋ', s: 'Mitákuye Oyásʼiŋ', e: 'All my relations, we are all connected.' },
          { t: 'Mitákuye Oyásʼiŋ', s: 'Mitákuye Oyásʼiŋ', e: 'All my relations, we are all connected.' }
        ],
        translation: 'A Lakota prayer of kinship, "all my relations", repeated as a meditation on our connection to every living thing.'
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
          { t: 'and to the center where we stand, all my relations. Aho.' }
        ],
        translation: 'A widely shared honoring of the directions, a prayer of gratitude to the world that holds us.'
      },
      {
        id: 'hoozho',
        title: 'Hózhó, The Beauty Way',
        lang: 'en',
        langLabel: 'English · from the Navajo tradition',
        phrases: [
          { t: 'In beauty I walk.' },
          { t: 'With beauty before me, beauty behind me,' },
          { t: 'beauty above me, beauty below me,' },
          { t: 'beauty all around me.' },
          { t: 'It is finished in beauty. Hózhó náhásdlíí.' }
        ],
        translation: 'The Beauty Way of the Navajo, walking in harmony with all that is, begun in beauty and finished in beauty.'
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
        translation: 'The Hawaiian practice of reconciliation and healing, forgiveness, gratitude, and love offered to set things right.'
      },
      {
        id: 'karakia',
        title: 'Karakia Whakamutunga, A Blessing of Peace',
        lang: 'mi',
        langLabel: 'Te Reo Māori · Māori',
        phrases: [
          { t: 'Kia hora te marino', e: 'May peace be widespread.' },
          { t: 'Kia whakapapa pounamu te moana', e: 'May the sea be like greenstone.' },
          { t: 'Kia tere te kārohirohi i mua i tōu huarahi', e: 'May the shimmer of light dance across your path.' },
          { t: 'Kia tau te aroha', e: 'May love settle upon you.' }
        ],
        translation: 'A karakia of peace and blessing from Aotearoa, calm waters, dancing light, and love.'
      },
      {
        id: 'pachamama',
        title: 'Pachamama, Mother Earth',
        lang: 'en',
        langLabel: 'English · from the Andean tradition',
        phrases: [
          { t: 'Pachamama, Mother Earth, we give you thanks.' },
          { t: 'For the fields that feed us and the mountains that hold us,' },
          { t: 'for the rain that falls and the sun that ripens.' },
          { t: 'We return to you what we take,' },
          { t: 'and walk softly upon your body.' }
        ],
        translation: 'A reflection in the Andean tradition, gratitude and reciprocity with Pachamama, Mother Earth.'
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
        translation: 'A prayer of thanksgiving for the living land, gratitude that keeps us humble and generous.'
      },
      {
        id: 'seven-teachings',
        title: 'The Seven Grandfather Teachings',
        lang: 'en',
        langLabel: 'English · from the Anishinaabe tradition',
        phrases: [
          { t: 'The elders gave us seven gifts to live by:' },
          { t: 'Wisdom, Love, Respect,' },
          { t: 'Bravery, Honesty, Humility, and Truth.' },
          { t: 'May I honour each one today' },
          { t: 'in the way I speak and the way I live.' }
        ],
        translation: 'A reflection on the Seven Grandfather Teachings of the Anishinaabe, the virtues that make a good life.'
      },
      {
        id: 'lakota-wopila',
        title: 'W\u00f3phila, A Lakota Thanksgiving',
        lang: 'en',
        langLabel: 'English · from the Lakota tradition',
        phrases: [
          { t: 'W\u00f3phila, thank you.' },
          { t: 'To the Great Mystery, thank you.' },
          { t: 'To the sun that warms us and the rain that waters us, thank you.' },
          { t: 'To all our relatives — the four-legged, the winged, the finned, and the rooted, thank you.' },
          { t: 'Mit\u00e1kuye Oy\u00e1s\u02bei\u014b, all my relations.' }
        ],
        translation: 'A Lakota prayer of thanksgiving, gratitude offered to the Great Mystery and to all of creation, our relatives.'
      },
      {
        id: 'cherokee-morning',
        title: 'A Cherokee Morning Prayer',
        lang: 'en',
        langLabel: 'English · from the Cherokee tradition',
        phrases: [
          { t: 'Great Spirit, I greet this morning with a thankful heart.' },
          { t: 'For the breath of life and the light of day, I give thanks.' },
          { t: 'Help me walk in harmony and in peace today.' },
          { t: 'Let me be kind to all I meet,' },
          { t: 'and remember that we are all relatives. Wado.' }
        ],
        translation: 'A Cherokee morning prayer of gratitude to the Great Spirit, asking for harmony, peace, and kindness.'
      },
      {
        id: 'hopi-rains',
        title: 'A Hopi Prayer for Rain',
        lang: 'en',
        langLabel: 'English · from the Hopi tradition',
        phrases: [
          { t: 'May the clouds gather gently over the land.' },
          { t: 'May the rain come soft and steady.' },
          { t: 'May the corn grow tall and the fields be green.' },
          { t: 'We are the Water People; we give thanks for the gift of life.' },
          { t: 'In the way of the ancestors, so be it. Paatuwapqa.' }
        ],
        translation: 'A Hopi prayer for the rains that bring life to the fields, gratitude to the clouds and the water.'
      },
      {
        id: 'inuit-sila',
        title: 'Sila, The Great Breath',
        lang: 'en',
        langLabel: 'English · from the Inuit tradition',
        phrases: [
          { t: 'Sila, the great breath of the world,' },
          { t: 'you are in every wind and every sky.' },
          { t: 'You give us the air we breathe and the wisdom to live.' },
          { t: 'When I am lost, quiet my mind and show me the way.' },
          { t: 'I walk gently upon this land, as the ancestors taught. Qujannamiik.' }
        ],
        translation: 'An Inuit prayer to Sila, the spirit of the air and sky, asking for wisdom and a gentle way of living.'
      },
      {
        id: 'ojibwe-water',
        title: 'Nibi, A Water Prayer',
        lang: 'en',
        langLabel: 'English · from the Anishinaabe tradition',
        phrases: [
          { t: 'Nibi, we thank you for your gifts.' },
          { t: 'You give us life, you carry us, you cleanse us.' },
          { t: 'As women carry life, so you carry the world.' },
          { t: 'We promise to care for you as you care for us,' },
          { t: 'for the children and the children yet to come.' }
        ],
        translation: 'An Anishinaabe water prayer honouring Nibi, the water that gives and sustains all life.'
      },
      {
        id: 'maya-dawn',
        title: 'A Maya Greeting to the Dawn',
        lang: 'en',
        langLabel: 'English · from the Maya tradition',
        phrases: [
          { t: 'Ajaw, Lord of the dawn, I greet you.' },
          { t: 'As the sun rises over the forest, so may joy rise in my heart.' },
          { t: 'Thank you for this day, for the maize and the water,' },
          { t: 'for the ancestors who watch over us.' },
          { t: 'Let me live in balance with the earth, in beauty and in thanks.' }
        ],
        translation: 'A Maya greeting to the rising sun, a prayer of thanks for the day, the maize, and the guidance of ancestors.'
      },
      {
        id: 'inca-inti',
        title: 'Inti, A Prayer to the Sun',
        lang: 'en',
        langLabel: 'English · from the Andean tradition',
        phrases: [
          { t: 'Inti, father sun, we give you thanks.' },
          { t: 'Pachamama, mother earth, we give you thanks.' },
          { t: 'For the harvest and the rain, for the mountains and the rivers, thank you.' },
          { t: 'May we live in ayni, in sacred reciprocity with all that is.' },
          { t: 'From our hearts to the heart of the world: thank you.' }
        ],
        translation: 'An Andean prayer to Inti the sun and Pachamama the earth, living in ayni, the sacred give and take of life.'
      },
      {
        id: 'amazon-forest',
        title: 'A Prayer of the Forest Peoples',
        lang: 'en',
        langLabel: 'English · with the peoples of the Amazon',
        phrases: [
          { t: 'O spirit of the living forest,' },
          { t: 'thank you for the breath of the trees and the song of the river.' },
          { t: 'Every leaf, every creature, every stream is our kin.' },
          { t: 'Help us protect this green home for all who live within it,' },
          { t: 'and walk with the forest in the way of our elders.' }
        ],
        translation: 'A prayer of the peoples of the great rainforest, honouring the living forest as home and family.'
      },
      {
        id: 'aboriginal-country',
        title: 'A Prayer for Country',
        lang: 'en',
        langLabel: 'English · from the Aboriginal peoples of Australia',
        phrases: [
          { t: 'The land is our mother; we are the land.' },
          { t: 'From the Dreaming, we carry the songlines of our ancestors.' },
          { t: 'Thank you, Country, for the water, the food, and the shelter.' },
          { t: 'May I care for you as you have always cared for us,' },
          { t: 'and pass this love of country to the children to come.' }
        ],
        translation: 'A prayer of the Aboriginal peoples for Country, the deep bond between people and the living land.'
      },
      {
        id: 'maori-harvest',
        title: 'A Harvest Prayer',
        lang: 'mi',
        langLabel: 'Te Reo M\u0101ori \u00b7 M\u0101ori',
        phrases: [
          { t: 'He mihi aroha ki te whenua', s: 'He mihi aroha ki te whenua', e: 'A loving thanks to the land,' },
          { t: 'ki ng\u0101 mea katoa e tipu mai ana', s: 'ki ng\u0101 mea katoa e tipu mai ana', e: 'and to all that grows from it.' },
          { t: 'He mihi ki ng\u0101 t\u016bpuna', s: 'He mihi ki ng\u0101 t\u016bpuna', e: 'Thanks to the ancestors' },
          { t: 'n\u0101 r\u0101tou te whakaaro nui ki te whenua', s: 'n\u0101 r\u0101tou te whakaaro nui ki te whenua', e: 'who taught us to care for the earth.' }
        ],
        translation: 'A M\u0101ori prayer of the harvest, giving thanks to the land and to the ancestors who cared for it.'
      },
      {
        id: 'samoan-faafetai',
        title: 'Fa\u2019afetai, A Prayer of Thanks',
        lang: 'en',
        langLabel: 'English \u00b7 from the S\u0101moan tradition',
        phrases: [
          { t: 'Fa\u2019afetai tele lava — thank you from the heart.' },
          { t: 'To God, the source of all blessings, thank you.' },
          { t: 'To the land and the sea that feed us, thank you.' },
          { t: 'To the family who surrounds us with alofa, love, thank you.' },
          { t: 'May our lives be a gift to others, as theirs are a gift to us.' }
        ],
        translation: 'A S\u0101moan prayer of deep gratitude for God, land, sea, and family, and the love that holds them all.'
      },
      {
        id: 'hawaiian-pule',
        title: 'A Hawaiian Prayer of Gratitude',
        lang: 'en',
        langLabel: 'English \u00b7 from the Hawaiian tradition',
        phrases: [
          { t: 'Ke Akua, Great Spirit of life, we give thanks.' },
          { t: 'For the sun, the sea, and the green land, thank you.' },
          { t: 'For our k\u016bpuna, our elders and ancestors, thank you.' },
          { t: 'Help us live with aloha — love for all — in all we do.' },
          { t: 'Mahalo nui loa, thank you with all our heart.' }
        ],
        translation: 'A Hawaiian pule, a prayer of gratitude to Ke Akua for the land, the elders, and the way of aloha.'
      },
      {
        id: 'mapuche-newen',
        title: 'Newen, A Prayer for Strength',
        lang: 'en',
        langLabel: 'English \u00b7 from the Mapuche tradition',
        phrases: [
          { t: 'Newen, the strength of the spirit,' },
          { t: 'fill my heart with courage and my hands with gentleness.' },
          { t: 'Like the araucaria that stands in the storm,' },
          { t: 'let me be rooted and unbending in what is right.' },
          { t: 'From the land and the ancestors, I receive this strength. Marichiwew.' }
        ],
        translation: 'A Mapuche prayer for newen, inner strength, rooted like the sacred tree and guided by the ancestors.'
      },
      {
        id: 'sami-beaivi',
        title: 'Beaivi, The Sun Mother',
        lang: 'en',
        langLabel: 'English \u00b7 from the S\u00e1mi tradition',
        phrases: [
          { t: 'Beaivi, mother sun, warm our hearts and our land.' },
          { t: 'Thank you for the light that wakes the earth each spring.' },
          { t: 'May we live in harmony with the reindeer and the tundra,' },
          { t: 'as the elders of the S\u00e1pmi have always done.' },
          { t: 'Your light reminds us: we are one with all that lives.' }
        ],
        translation: 'A S\u00e1mi prayer to Beaivi, the sun mother, for warmth, harmony, and oneness with the living land.'
      },
      {
        id: 'ainu-kamuy',
        title: 'A Prayer to the Kamuy',
        lang: 'en',
        langLabel: 'English \u00b7 from the Ainu tradition',
        phrases: [
          { t: 'O kamuy, spirits of the forest, the river, and the sea,' },
          { t: 'we welcome you and give you thanks.' },
          { t: 'You give us the deer, the salmon, and the good water.' },
          { t: 'We honour you with humble hearts and gentle hands,' },
          { t: 'and we vow to protect this land you have entrusted to us.' }
        ],
        translation: 'An Ainu prayer to the kamuy, the spirits of nature, expressing gratitude and the sacred duty to protect the land.'
      },
      {
        id: 'mongolian-sky',
        title: 'The Eternal Blue Sky',
        lang: 'en',
        langLabel: 'English \u00b7 from the steppe traditions',
        phrases: [
          { t: 'O eternal blue sky, Tengri of our fathers,' },
          { t: 'we raise our hearts to your endless horizon.' },
          { t: 'Thank you for the wind, the grass, and the open road.' },
          { t: 'Grant us the wisdom of the steppe: to move with the seasons,' },
          { t: 'to honour all beings, and to keep faith with the land.' }
        ],
        translation: 'A prayer of the steppe peoples to the eternal blue sky, gratitude for the open land and the wisdom to live within it.'
      }
    ]
  },
  {
    id: 'zoroastrianism',
    name: 'Zoroastrianism',
    emoji: '🕯️',
    glow: 'rgba(255, 190, 90, 0.26)',
    lightColor: '#ffc46b',
    tagline: 'Good thoughts, good words, good deeds, the flame of truth.',
    prayers: [
      {
        id: 'ashem-vohu',
        title: 'Ashem Vohu',
        lang: 'ae',
        langLabel: 'Avestan · repeated',
        loop: true,
        phrases: [
          { t: 'Ashəm vohū vahishtəm astī, ushtā astī, ushtā ahmāi, hyat ashāi vahishtāi ashəm.', s: 'Ashəm vohū vahishtəm astī, ushtā astī, ushtā ahmāi, hyat ashāi vahishtāi ashəm.', e: 'Righteousness is the best good, and it is happiness, happiness to the one who is righteous for the sake of the highest righteousness.' },
          { t: 'Ashəm vohū vahishtəm astī, ushtā astī, ushtā ahmāi, hyat ashāi vahishtāi ashəm.', s: 'Ashəm vohū vahishtəm astī, ushtā astī, ushtā ahmāi, hyat ashāi vahishtāi ashəm.', e: 'Righteousness is the best good, and it is happiness, happiness to the one who is righteous for the sake of the highest righteousness.' },
          { t: 'Ashəm vohū vahishtəm astī, ushtā astī, ushtā ahmāi, hyat ashāi vahishtāi ashəm.', s: 'Ashəm vohū vahishtəm astī, ushtā astī, ushtā ahmāi, hyat ashāi vahishtāi ashəm.', e: 'Righteousness is the best good, and it is happiness, happiness to the one who is righteous for the sake of the highest righteousness.' }
        ],
        translation: 'One of the most sacred prayers of Zoroastrianism, the vow of a life aligned with truth and righteousness.'
      },
      {
        id: 'ahuna-vairya',
        title: 'Ahuna Vairya',
        lang: 'ae',
        langLabel: 'Avestan',
        phrases: [
          { t: 'Yatā ahū vairyō, aθā ratuš ašāt̰cīt̰ hacā', s: 'Yatā ahū vairyō, athā ratush ashatchit hachā', e: 'As the heavenly Lord is to be chosen, so is the earthly judge, in accord with truth.' },
          { t: 'vaŋhə̄uš dazdā manaŋhō, šyaoθananąm aŋhə̄uš mazdāi', s: 'Vanghēush dazdā mananghō, shyaothananām anghēush mazdāi', e: 'By the good mind, may deeds be done for Mazda.' },
          { t: 'xšaθrəmcā ahurāi, ā yim drigubyō dadat̰ vāstārəm.', s: 'Khshathremchā ahurāi, ā yim drigubyō dadat vāstārem.', e: 'And the Kingdom of Ahura, for those who give the poor a shepherd.' }
        ],
        translation: 'The Ahuna Vairya, the most sacred formula of the Zoroastrian faith, the seal of truth and care for the vulnerable.'
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
        translation: 'A reflection on the sacred fire, a reminder that each person carries a flame of truth to tend and share.'
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
        translation: 'The threefold path at the heart of Zoroastrian faith, thought, speech, and action kept pure.'
      },
      {
        id: 'good-conduct',
        title: 'A Prayer of Good Conduct',
        lang: 'en',
        langLabel: 'English',
        phrases: [
          { t: 'O Wise Lord, source of all that is good,' },
          { t: 'let me think good thoughts, speak good words, and do good deeds.' },
          { t: 'Let me be a friend to the truthful and a shelter to the weary.' },
          { t: 'May the fire within my heart warm, and never burn.' },
          { t: 'May I walk the path of Asha, truth and harmony, all my days.' }
        ],
        translation: 'A prayer of the Asha path, keeping thought, word, and deed aligned with the good.'
      }
    ]
  }
]

export const SPIRITUALITY_BY_ID = Object.fromEntries(
  SPIRITUALITIES.map((s) => [s.id, s])
)
