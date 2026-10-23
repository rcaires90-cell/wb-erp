// Traduções dos formulários públicos (espanhol, inglês, francês, crioulo haitiano, persa).
// Só muda o que o CLIENTE vê: as respostas continuam sendo gravadas com a
// pergunta e a opção em português, pra equipe ler tudo igual no Pipeline.
// Pergunta sem tradução aqui aparece em português (nunca quebra).

const IDIOMAS_TRAD = ['es', 'en', 'fr', 'ht', 'fa'];

// Opções de resposta (valor gravado em português → texto exibido)
const OPCOES = {
  'Sim':            { es: 'Sí', en: 'Yes', fr: 'Oui' },
  'Não':            { es: 'No', en: 'No', fr: 'Non' },
  'Permanente':     { es: 'Permanente', en: 'Permanent', fr: 'Permanent' },
  'Temporário':     { es: 'Temporal', en: 'Temporary', fr: 'Temporaire' },
  'Ainda não tem':  { es: 'Todavía no tengo', en: "I don't have one yet", fr: "Je n'en ai pas encore" },
  'CPLP':           { es: 'CPLP', en: 'CPLP', fr: 'CPLP' },
  'Reunião Familiar': { es: 'Reunión familiar', en: 'Family reunion', fr: 'Regroupement familial' },
  'Mercosul':       { es: 'Mercosur', en: 'Mercosur', fr: 'Mercosur' },
  'Não sei — preciso de orientação': { es: 'No sé — necesito orientación', en: "I don't know — I need guidance", fr: "Je ne sais pas — j'ai besoin d'aide" },
  'Solteiro(a)':    { es: 'Soltero(a)', en: 'Single', fr: 'Célibataire' },
  'Casado(a)':      { es: 'Casado(a)', en: 'Married', fr: 'Marié(e)' },
  'União estável':  { es: 'Unión estable', en: 'Common-law partnership', fr: 'Union libre' },
  'Divorciado(a)':  { es: 'Divorciado(a)', en: 'Divorced', fr: 'Divorcé(e)' },
  'Viúvo(a)':       { es: 'Viudo(a)', en: 'Widowed', fr: 'Veuf / Veuve' },
};

// Por formulário: titulo, secoes (na mesma ordem) e perguntas por id
const FORMULARIOS_I18N = {
  naturalizacao: {
    titulo: { es: 'Naturalización Brasileña', en: 'Brazilian Naturalization', fr: 'Naturalisation Brésilienne' },
    secoes: [
      { es: '01 · Datos personales', en: '01 · Personal information', fr: '01 · Informations personnelles' },
      { es: '02 · Situación migratoria y requisitos', en: '02 · Immigration status and eligibility', fr: '02 · Situation migratoire et éligibilité' },
      { es: '03 · Próximos pasos', en: '03 · Next steps', fr: '03 · Prochaines étapes' },
    ],
    perguntas: {
      nacionalidade:      { es: 'Nacionalidad / país de origen', en: 'Nationality / country of origin', fr: "Nationalité / pays d'origine" },
      data_entrada:       { es: 'Fecha de llegada a Brasil', en: 'Date of arrival in Brazil', fr: "Date d'arrivée au Brésil" },
      rnm_tipo:           { es: 'Tipo de RNM que tiene', en: 'Type of RNM you have', fr: 'Type de RNM que vous possédez' },
      rnm_data_emissao:   { es: 'Fecha de emisión del RNM', en: 'RNM issue date', fr: "Date d'émission du RNM",
        dica: { es: 'Está en el reverso de la tarjeta del RNM, junto a "EMISSÃO" — no confundir con la "VALIDADE".',
                en: 'It is on the back of the RNM card, next to "EMISSÃO" — not the "VALIDADE" (expiry) date.',
                fr: 'Au verso de la carte RNM, à côté de « EMISSÃO » — à ne pas confondre avec la « VALIDADE ».' } },
      vinculo_brasileiro: { es: '¿Está casado(a) o tiene hijo(a) brasileño(a)?', en: 'Are you married to a Brazilian or do you have a Brazilian child?', fr: 'Êtes-vous marié(e) à un(e) Brésilien(ne) ou avez-vous un enfant brésilien ?' },
      curso_portugues:    { es: '¿Ya hizo algún curso de portugués? ¿Cuál?', en: 'Have you taken a Portuguese language course? Which one?', fr: 'Avez-vous suivi un cours de portugais ? Lequel ?' },
      urgencia:           { es: '¿Cuándo piensa iniciar el proceso?', en: 'When do you plan to start the process?', fr: 'Quand pensez-vous commencer la démarche ?' },
    },
  },
  residencia: {
    titulo: { es: 'Autorización de Residencia', en: 'Residence Authorization', fr: 'Autorisation de Résidence' },
    secoes: [
      { es: '01 · Datos personales', en: '01 · Personal information', fr: '01 · Informations personnelles' },
      { es: '02 · Vínculo y situación', en: '02 · Family ties and status', fr: '02 · Liens familiaux et situation' },
      { es: '03 · Ubicación y plazo', en: '03 · Location and timing', fr: '03 · Lieu et délai' },
    ],
    perguntas: {
      nacionalidade:      { es: 'Nacionalidad / país de origen', en: 'Nationality / country of origin', fr: "Nationalité / pays d'origine" },
      visto:              { es: '¿Qué visa tiene?', en: 'What visa do you have?', fr: 'Quel visa avez-vous ?' },
      data_entrada:       { es: 'Fecha de llegada a Brasil', en: 'Date of arrival in Brazil', fr: "Date d'arrivée au Brésil" },
      vinculo_brasileiro: { es: '¿Tiene hijo(a) brasileño(a) o está casado(a) con brasileño(a)?', en: 'Do you have a Brazilian child or are you married to a Brazilian?', fr: 'Avez-vous un enfant brésilien ou êtes-vous marié(e) à un(e) Brésilien(ne) ?' },
      base_legal:         { es: '¿Qué base legal pretende usar?', en: 'Which legal basis do you intend to use?', fr: 'Quelle base légale souhaitez-vous utiliser ?' },
      localizacao:        { es: 'Ciudad/Estado donde piensa vivir', en: 'City/State where you plan to live', fr: 'Ville/État où vous comptez résider' },
      urgencia:           { es: 'Plazo / urgencia deseada', en: 'Desired timeline / urgency', fr: 'Délai / urgence souhaité(e)' },
    },
  },
  visto_eua: {
    titulo: { es: 'Visa de EE. UU. (Turismo/Negocios B1/B2)', en: 'US Visa (Tourism/Business B1/B2)', fr: 'Visa États-Unis (Tourisme/Affaires B1/B2)' },
    secoes: [
      { es: '01 · Datos personales y del pasaporte', en: '01 · Personal and passport information', fr: '01 · Informations personnelles et passeport' },
      { es: '02 · Medios de contacto', en: '02 · Contact information', fr: '02 · Coordonnées' },
      { es: '03 · Direcciones', en: '03 · Addresses', fr: '03 · Adresses' },
      { es: '04 · Familia y estado civil', en: '04 · Family and marital status', fr: '04 · Famille et état civil' },
      { es: '05 · Trabajo o estudios', en: '05 · Work or school', fr: '05 · Travail ou études' },
      { es: '06 · Formación académica e idiomas', en: '06 · Education and languages', fr: '06 · Formation et langues' },
      { es: '07 · Viajes y salud', en: '07 · Travel and health', fr: '07 · Voyages et santé' },
    ],
    perguntas: {
      nome_passaporte:      { es: 'Nombre completo exactamente como aparece en el pasaporte', en: 'Full name exactly as it appears on your passport', fr: 'Nom complet exactement comme sur le passeport' },
      data_nascimento:      { es: 'Fecha de nacimiento', en: 'Date of birth', fr: 'Date de naissance' },
      local_nascimento:     { es: 'Ciudad / Estado de nacimiento', en: 'City / State of birth', fr: 'Ville / État de naissance' },
      passaporte_num:       { es: 'Número de pasaporte', en: 'Passport number', fr: 'Numéro de passeport' },
      passaporte_emissao:   { es: 'Fecha de emisión', en: 'Issue date', fr: "Date d'émission" },
      passaporte_venc:      { es: 'Fecha de vencimiento', en: 'Expiry date', fr: "Date d'expiration" },
      nome_pai:             { es: 'Nombre completo del padre', en: "Father's full name", fr: 'Nom complet du père' },
      nome_mae:             { es: 'Nombre completo de la madre', en: "Mother's full name", fr: 'Nom complet de la mère' },
      visto_negado:         { es: '¿Alguna vez le negaron una visa?', en: 'Have you ever been refused a visa?', fr: 'Vous a-t-on déjà refusé un visa ?' },
      visto_negado_detalhe: { es: 'Si es así: qué país y motivo', en: 'If yes: which country and why', fr: 'Si oui : quel pays et pour quel motif' },
      mudou_nome:           { es: '¿Alguna vez cambió de nombre?', en: 'Have you ever changed your name?', fr: 'Avez-vous déjà changé de nom ?' },
      nome_anterior:        { es: 'Si es así: nombre anterior', en: 'If yes: previous name', fr: 'Si oui : nom précédent' },
      tel_celular:          { es: 'Teléfono celular', en: 'Mobile phone', fr: 'Téléphone portable' },
      tel_comercial:        { es: 'Teléfono del trabajo', en: 'Work phone', fr: 'Téléphone professionnel' },
      tel_residencial:      { es: 'Teléfono de casa', en: 'Home phone', fr: 'Téléphone fixe' },
      redes_sociais:        { es: 'Redes sociales (Instagram, Facebook, X, LinkedIn...)', en: 'Social media (Instagram, Facebook, X, LinkedIn...)', fr: 'Réseaux sociaux (Instagram, Facebook, X, LinkedIn...)' },
      endereco_brasil:      { es: 'Dirección completa en Brasil (calle, número, complemento, barrio, ciudad, estado y CEP)', en: 'Full address in Brazil (street, number, unit, neighborhood, city, state and CEP)', fr: 'Adresse complète au Brésil (rue, numéro, complément, quartier, ville, État et CEP)' },
      endereco_eua:         { es: 'Dirección donde se quedará en EE. UU. (hotel o casa de familiar)', en: 'Where you will stay in the US (hotel or relative’s home)', fr: 'Adresse où vous logerez aux États-Unis (hôtel ou famille)' },
      estado_civil:         { es: 'Estado civil', en: 'Marital status', fr: 'État civil' },
      conjuge_nome:         { es: 'Nombre completo del cónyuge', en: "Spouse's full name", fr: 'Nom complet du conjoint' },
      conjuge_nacionalidade:{ es: 'Nacionalidad del cónyuge', en: "Spouse's nationality", fr: 'Nationalité du conjoint' },
      conjuge_nascimento:   { es: 'Fecha de nacimiento del cónyuge', en: "Spouse's date of birth", fr: 'Date de naissance du conjoint' },
      conjuge_cidade_nasc:  { es: 'Ciudad de nacimiento del cónyuge', en: "Spouse's city of birth", fr: 'Ville de naissance du conjoint' },
      parentes_eua:         { es: '¿Tiene familiares en EE. UU.?', en: 'Do you have relatives in the US?', fr: 'Avez-vous de la famille aux États-Unis ?' },
      parentes_eua_detalhe: { es: 'Si es así: nombre y parentesco', en: 'If yes: name and relationship', fr: 'Si oui : nom et lien de parenté' },
      empresa_escola:       { es: 'Nombre de la empresa o escuela', en: 'Company or school name', fr: "Nom de l'entreprise ou de l'école" },
      empresa_endereco:     { es: 'Dirección', en: 'Address', fr: 'Adresse' },
      empresa_telefone:     { es: 'Teléfono', en: 'Phone', fr: 'Téléphone' },
      cargo:                { es: 'Cargo o función', en: 'Job title or role', fr: 'Poste ou fonction' },
      renda_mensal:         { es: 'Ingreso mensual', en: 'Monthly income', fr: 'Revenu mensuel' },
      tempo_emprego:        { es: 'Tiempo en el empleo actual', en: 'Time at current job', fr: "Ancienneté dans l'emploi actuel" },
      emprego_anterior:     { es: 'Empleo anterior — solo si tiene menos de 5 años en el actual (empresa, cargo y período)', en: 'Previous job — only if less than 5 years at the current one (company, role and period)', fr: "Emploi précédent — seulement si moins de 5 ans dans l'actuel (entreprise, poste et période)" },
      graduacao:            { es: 'Carrera universitaria (curso e institución)', en: "Bachelor's degree (course and institution)", fr: 'Diplôme universitaire (cursus et établissement)' },
      pos_graduacao:        { es: 'MBA / Posgrado, si tiene', en: 'MBA / Postgraduate degree, if any', fr: 'MBA / Master, le cas échéant' },
      idiomas:              { es: 'Idiomas además del portugués', en: 'Languages besides Portuguese', fr: 'Langues en plus du portugais' },
      viagens_5anos:        { es: 'Viajes internacionales en los últimos 5 años, aparte de EE. UU. — qué países', en: 'International trips in the last 5 years, other than the US — which countries', fr: 'Voyages internationaux des 5 dernières années, hors États-Unis — quels pays' },
      doenca_risco:         { es: '¿Enfermedad contagiosa de riesgo para la salud pública (ej.: tuberculosis)?', en: 'Contagious disease that is a public health risk (e.g. tuberculosis)?', fr: 'Maladie contagieuse à risque pour la santé publique (ex. : tuberculose) ?' },
      doenca_risco_detalhe: { es: 'Si es así: qué enfermedad', en: 'If yes: which disease', fr: 'Si oui : quelle maladie' },
    },
  },
};


// ── Persa (fa) e crioulo haitiano (ht) ──
// Bloco separado pra facilitar a revisão por quem fala cada língua.
const EXTRA_OPCOES = {
  'Sim':            { fa: 'بله', ht: 'Wi' },
  'Não':            { fa: 'خیر', ht: 'Non' },
  'Permanente':     { fa: 'دائم', ht: 'Pèmanan' },
  'Temporário':     { fa: 'موقت', ht: 'Tanporè' },
  'Ainda não tem':  { fa: 'هنوز ندارم', ht: 'Mwen poko genyen' },
  'CPLP':           { fa: 'CPLP', ht: 'CPLP' },
  'Reunião Familiar': { fa: 'پیوستن به خانواده', ht: 'Reyinyon fanmi' },
  'Mercosul':       { fa: 'مرکوسور', ht: 'Mercosur' },
  'Não sei — preciso de orientação': { fa: 'نمی‌دانم — به راهنمایی نیاز دارم', ht: 'Mwen pa konnen — mwen bezwen konsèy' },
  'Solteiro(a)':    { fa: 'مجرد', ht: 'Selibatè' },
  'Casado(a)':      { fa: 'متأهل', ht: 'Marye' },
  'União estável':  { fa: 'زندگی مشترک ثبت‌شده', ht: 'Plasaj (inyon estab)' },
  'Divorciado(a)':  { fa: 'مطلقه / جداشده', ht: 'Divòse' },
  'Viúvo(a)':       { fa: 'همسر فوت‌شده', ht: 'Vèv' },
};

const EXTRA_FORMS = {
  naturalizacao: {
    titulo: { fa: 'تابعیت برزیل', ht: 'Natiralizasyon brezilyen' },
    secoes: [
      { fa: '۰۱ · اطلاعات شخصی', ht: '01 · Enfòmasyon pèsonèl' },
      { fa: '۰۲ · وضعیت مهاجرتی و شرایط', ht: '02 · Sitiyasyon imigrasyon ak kondisyon' },
      { fa: '۰۳ · مراحل بعدی', ht: '03 · Pwochen etap yo' },
    ],
    perguntas: {
      nacionalidade:      { fa: 'ملیت / کشور مبدأ', ht: 'Nasyonalite / peyi ou soti' },
      data_entrada:       { fa: 'تاریخ ورود به برزیل', ht: 'Dat ou antre nan Brezil' },
      rnm_tipo:           { fa: 'نوع کارت RNM شما', ht: 'Ki kalite RNM ou genyen' },
      rnm_data_emissao:   { fa: 'تاریخ صدور RNM', ht: 'Dat yo bay RNM nan',
        dica: { fa: 'پشت کارت RNM، کنار کلمه «EMISSÃO» نوشته شده — با «VALIDADE» (تاریخ انقضا) اشتباه نگیرید.',
                ht: 'Li dèyè kat RNM nan, bò kote ki ekri "EMISSÃO" — pa konfonn li ak "VALIDADE" (dat ekspirasyon).' } },
      vinculo_brasileiro: { fa: 'آیا با یک برزیلی ازدواج کرده‌اید یا فرزند برزیلی دارید؟', ht: 'Èske ou marye ak yon brezilyen oswa ou gen yon pitit brezilyen?' },
      curso_portugues:    { fa: 'آیا دوره زبان پرتغالی گذرانده‌اید؟ کدام؟', ht: 'Èske ou te fè yon kou pòtigè? Kilès?' },
      urgencia:           { fa: 'چه زمانی می‌خواهید روند را شروع کنید؟', ht: 'Kilè ou vle kòmanse pwosesis la?' },
    },
  },
  residencia: {
    titulo: { fa: 'مجوز اقامت', ht: 'Otorizasyon rezidans' },
    secoes: [
      { fa: '۰۱ · اطلاعات شخصی', ht: '01 · Enfòmasyon pèsonèl' },
      { fa: '۰۲ · پیوند خانوادگی و وضعیت', ht: '02 · Lyen fanmi ak sitiyasyon' },
      { fa: '۰۳ · محل و زمان', ht: '03 · Kote ak delè' },
    ],
    perguntas: {
      nacionalidade:      { fa: 'ملیت / کشور مبدأ', ht: 'Nasyonalite / peyi ou soti' },
      visto:              { fa: 'چه ویزایی دارید؟', ht: 'Ki viza ou genyen?' },
      data_entrada:       { fa: 'تاریخ ورود به برزیل', ht: 'Dat ou antre nan Brezil' },
      vinculo_brasileiro: { fa: 'آیا فرزند برزیلی دارید یا با یک برزیلی ازدواج کرده‌اید؟', ht: 'Èske ou gen yon pitit brezilyen oswa ou marye ak yon brezilyen?' },
      base_legal:         { fa: 'بر اساس کدام مبنای قانونی درخواست می‌دهید؟', ht: 'Ki baz legal ou vle itilize?' },
      localizacao:        { fa: 'شهر/ایالتی که می‌خواهید در آن ساکن شوید', ht: 'Vil/Eta kote ou vle rete' },
      urgencia:           { fa: 'زمان / فوریت مورد نظر', ht: 'Delè / ijans ou vle' },
    },
  },
  visto_eua: {
    titulo: { fa: 'ویزای آمریکا (توریستی/تجاری B1/B2)', ht: 'Viza Etazini (Touris/Biznis B1/B2)' },
    secoes: [
      { fa: '۰۱ · اطلاعات شخصی و پاسپورت', ht: '01 · Enfòmasyon pèsonèl ak paspò' },
      { fa: '۰۲ · راه‌های تماس', ht: '02 · Kijan pou kontakte w' },
      { fa: '۰۳ · آدرس‌ها', ht: '03 · Adrès yo' },
      { fa: '۰۴ · خانواده و وضعیت تأهل', ht: '04 · Fanmi ak sitiyasyon matrimonyal' },
      { fa: '۰۵ · کار یا تحصیل', ht: '05 · Travay oswa lekòl' },
      { fa: '۰۶ · تحصیلات و زبان‌ها', ht: '06 · Etid ak lang' },
      { fa: '۰۷ · سفرها و سلامت', ht: '07 · Vwayaj ak sante' },
    ],
    perguntas: {
      nome_passaporte:      { fa: 'نام کامل دقیقاً مطابق پاسپورت', ht: 'Non konplè egzakteman jan li ekri nan paspò a' },
      data_nascimento:      { fa: 'تاریخ تولد', ht: 'Dat nesans' },
      local_nascimento:     { fa: 'شهر / استان محل تولد', ht: 'Vil / Eta kote ou fèt' },
      passaporte_num:       { fa: 'شماره پاسپورت', ht: 'Nimewo paspò' },
      passaporte_emissao:   { fa: 'تاریخ صدور', ht: 'Dat yo bay li' },
      passaporte_venc:      { fa: 'تاریخ انقضا', ht: 'Dat ekspirasyon' },
      nome_pai:             { fa: 'نام کامل پدر', ht: 'Non konplè papa w' },
      nome_mae:             { fa: 'نام کامل مادر', ht: 'Non konplè manman w' },
      visto_negado:         { fa: 'آیا تاکنون ویزای شما رد شده است؟', ht: 'Èske yo te janm refize w yon viza?' },
      visto_negado_detalhe: { fa: 'اگر بله: کدام کشور و به چه دلیل', ht: 'Si wi: ki peyi epi poukisa' },
      mudou_nome:           { fa: 'آیا تاکنون نام خود را تغییر داده‌اید؟', ht: 'Èske ou te janm chanje non?' },
      nome_anterior:        { fa: 'اگر بله: نام قبلی', ht: 'Si wi: ansyen non an' },
      tel_celular:          { fa: 'تلفن همراه', ht: 'Telefòn selilè' },
      tel_comercial:        { fa: 'تلفن محل کار', ht: 'Telefòn travay' },
      tel_residencial:      { fa: 'تلفن منزل', ht: 'Telefòn lakay' },
      redes_sociais:        { fa: 'شبکه‌های اجتماعی (اینستاگرام، فیسبوک، X، لینکدین...)', ht: 'Rezo sosyal (Instagram, Facebook, X, LinkedIn...)' },
      endereco_brasil:      { fa: 'آدرس کامل در برزیل (خیابان، پلاک، واحد، محله، شهر، ایالت و کد پستی CEP)', ht: 'Adrès konplè nan Brezil (ri, nimewo, konpleman, katye, vil, eta ak CEP)' },
      endereco_eua:         { fa: 'محل اقامت در آمریکا (هتل یا منزل اقوام)', ht: 'Kote w ap rete Ozetazini (otèl oswa lakay fanmi)' },
      estado_civil:         { fa: 'وضعیت تأهل', ht: 'Sitiyasyon matrimonyal' },
      conjuge_nome:         { fa: 'نام کامل همسر', ht: 'Non konplè mari/madanm ou' },
      conjuge_nacionalidade:{ fa: 'ملیت همسر', ht: 'Nasyonalite mari/madanm ou' },
      conjuge_nascimento:   { fa: 'تاریخ تولد همسر', ht: 'Dat nesans mari/madanm ou' },
      conjuge_cidade_nasc:  { fa: 'شهر محل تولد همسر', ht: 'Vil kote mari/madanm ou fèt' },
      parentes_eua:         { fa: 'آیا در آمریکا خویشاوند دارید؟', ht: 'Èske ou gen fanmi Ozetazini?' },
      parentes_eua_detalhe: { fa: 'اگر بله: نام و نسبت', ht: 'Si wi: non ak ki fanmi' },
      empresa_escola:       { fa: 'نام شرکت یا مدرسه', ht: 'Non konpayi oswa lekòl la' },
      empresa_endereco:     { fa: 'آدرس', ht: 'Adrès' },
      empresa_telefone:     { fa: 'تلفن', ht: 'Telefòn' },
      cargo:                { fa: 'سمت یا شغل', ht: 'Pòs oswa fonksyon' },
      renda_mensal:         { fa: 'درآمد ماهانه', ht: 'Revni chak mwa' },
      tempo_emprego:        { fa: 'مدت اشتغال در کار فعلی', ht: 'Konbyen tan ou genyen nan travay sa a' },
      emprego_anterior:     { fa: 'شغل قبلی — فقط اگر کمتر از ۵ سال در کار فعلی هستید (شرکت، سمت و مدت)', ht: 'Travay anvan — sèlman si ou gen mwens pase 5 an nan travay kounye a (konpayi, pòs ak peryòd)' },
      graduacao:            { fa: 'مدرک دانشگاهی (رشته و دانشگاه)', ht: 'Etid inivèsitè (kou ak enstitisyon)' },
      pos_graduacao:        { fa: 'MBA / تحصیلات تکمیلی، در صورت وجود', ht: 'MBA / Etid apre lisans, si genyen' },
      idiomas:              { fa: 'زبان‌ها به جز پرتغالی', ht: 'Lang ou pale apa pòtigè' },
      viagens_5anos:        { fa: 'سفرهای خارجی در ۵ سال گذشته، به جز آمریکا — کدام کشورها', ht: 'Vwayaj entènasyonal nan 5 dènye ane yo, apa Etazini — ki peyi' },
      doenca_risco:         { fa: 'بیماری مسری خطرناک برای سلامت عمومی (مثلاً سل)؟', ht: 'Maladi ki atrapan ki danjere pou sante piblik (egz.: tibèkiloz)?' },
      doenca_risco_detalhe: { fa: 'اگر بله: کدام بیماری', ht: 'Si wi: ki maladi' },
    },
  },
};

for (const [o, tr] of Object.entries(EXTRA_OPCOES)) Object.assign(OPCOES[o], tr);
for (const [k, ex] of Object.entries(EXTRA_FORMS)) {
  const f = FORMULARIOS_I18N[k];
  Object.assign(f.titulo, ex.titulo);
  ex.secoes.forEach((s, i) => Object.assign(f.secoes[i], s));
  for (const [id, tr] of Object.entries(ex.perguntas)) {
    const p = f.perguntas[id];
    for (const lng of ['fa', 'ht']) p[lng] = tr[lng];
    if (tr.dica) p.dica = { ...(p.dica || {}), ...tr.dica };
  }
}

// Junta as traduções no config (sem alterar o original). Cada pergunta
// ganha `t: { es: {label, dica, opcoes:[...]}, ... }`; opções sem tradução
// repetem o texto em português.
function comTraducoes(config) {
  const out = {};
  for (const [chave, cfg] of Object.entries(config)) {
    const tr = FORMULARIOS_I18N[chave] || {};
    out[chave] = {
      ...cfg,
      t: { titulo: tr.titulo || {} },
      secoes: cfg.secoes.map((sec, i) => ({
        ...sec,
        t: (tr.secoes || [])[i] || {},
        perguntas: sec.perguntas.map(p => {
          const tp = (tr.perguntas || {})[p.id] || {};
          const t = {};
          for (const lang of IDIOMAS_TRAD) {
            t[lang] = {
              label: tp[lang] || p.label,
              dica: tp.dica?.[lang] || p.dica,
              opcoes: p.opcoes ? p.opcoes.map(o => OPCOES[o]?.[lang] || o) : undefined,
            };
          }
          return { ...p, t };
        }),
      })),
    };
  }
  return out;
}

module.exports = { FORMULARIOS_I18N, OPCOES, comTraducoes, IDIOMAS_TRAD };
