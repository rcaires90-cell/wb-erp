// Idiomas das páginas públicas (landing, formulários por serviço e página
// de confirmação do agendamento). Português é o padrão; o idioma escolhido
// fica salvo no navegador e vai junto no envio (e-mails saem no mesmo idioma).
(function () {
  const IDIOMAS = { pt: 'Português', es: 'Español', en: 'English', fr: 'Français' };

  const T = {
    // ── Comum ──
    badge1:      { pt: 'Atendimento especializado', es: 'Atención especializada', en: 'Specialized support', fr: 'Accompagnement spécialisé' },
    badge2:      { pt: 'Processo 100% orientado', es: 'Proceso 100% guiado', en: '100% guided process', fr: 'Démarche 100 % accompagnée' },
    badge3:      { pt: 'Resposta rápida', es: 'Respuesta rápida', en: 'Fast response', fr: 'Réponse rapide' },
    cardTitulo:  { pt: 'Preencha seus dados para atendimento', es: 'Complete sus datos para la atención', en: 'Fill in your details', fr: 'Renseignez vos coordonnées' },
    nome:        { pt: 'Nome completo', es: 'Nombre completo', en: 'Full name', fr: 'Nom complet' },
    nomePh:      { pt: 'Seu nome completo', es: 'Su nombre completo', en: 'Your full name', fr: 'Votre nom complet' },
    whatsapp:    { pt: 'WhatsApp', es: 'WhatsApp', en: 'WhatsApp', fr: 'WhatsApp' },
    email:       { pt: 'E-mail', es: 'Correo electrónico', en: 'Email', fr: 'E-mail' },
    emailPh:     { pt: 'seu@email.com', es: 'su@correo.com', en: 'you@email.com', fr: 'vous@email.com' },
    contato:     { pt: 'Dados de contato', es: 'Datos de contacto', en: 'Contact details', fr: 'Coordonnées' },
    selecione:   { pt: 'Selecione', es: 'Seleccione', en: 'Select', fr: 'Choisir' },
    enviar:      { pt: 'Enviar', es: 'Enviar', en: 'Send', fr: 'Envoyer' },
    enviando:    { pt: 'Enviando...', es: 'Enviando...', en: 'Sending...', fr: 'Envoi...' },
    privacidade: { pt: 'Seus dados são usados exclusivamente para atendimento. Não compartilhamos com terceiros.',
                   es: 'Sus datos se usan solo para la atención. No los compartimos con terceros.',
                   en: 'Your data is used only to assist you. We never share it with third parties.',
                   fr: 'Vos données servent uniquement à votre accompagnement. Nous ne les partageons pas.' },
    erroEnvio:   { pt: 'Ocorreu um erro ao enviar. Tente novamente ou entre em contato pelo WhatsApp.',
                   es: 'Ocurrió un error al enviar. Intente de nuevo o contáctenos por WhatsApp.',
                   en: 'Something went wrong. Please try again or contact us on WhatsApp.',
                   fr: "Une erreur s'est produite. Réessayez ou contactez-nous sur WhatsApp." },
    errNome:     { pt: 'Nome obrigatório', es: 'Nombre obligatorio', en: 'Name is required', fr: 'Nom obligatoire' },
    errTel:      { pt: 'WhatsApp obrigatório', es: 'WhatsApp obligatorio', en: 'WhatsApp is required', fr: 'WhatsApp obligatoire' },
    errEmail:    { pt: 'E-mail obrigatório', es: 'Correo obligatorio', en: 'Email is required', fr: 'E-mail obligatoire' },
    errEmailInv: { pt: 'E-mail inválido', es: 'Correo inválido', en: 'Invalid email', fr: 'E-mail invalide' },
    wpp:         { pt: 'Fale conosco pelo WhatsApp', es: 'Escríbanos por WhatsApp', en: 'Chat with us on WhatsApp', fr: 'Écrivez-nous sur WhatsApp' },
    rodapeSlogan:{ pt: 'WB Assessoria Migratória — Especialistas em regularização migratória no Brasil.',
                   es: 'WB Assessoria Migratória — Especialistas en regularización migratoria en Brasil.',
                   en: 'WB Assessoria Migratória — Immigration specialists in Brazil.',
                   fr: "WB Assessoria Migratória — Spécialistes de l'immigration au Brésil." },

    // ── Landing ──
    heroTitulo1: { pt: 'Regularize sua situação no Brasil', es: 'Regularice su situación en Brasil', en: 'Get your status sorted in Brazil', fr: 'Régularisez votre situation au Brésil' },
    heroTitulo2: { pt: 'com quem entende de migração', es: 'con quien entiende de migración', en: 'with immigration experts', fr: "avec des experts de l'immigration" },
    heroSub:     { pt: 'Preencha o formulário e nossa equipe entrará em contato para orientar você no processo mais adequado ao seu caso.',
                   es: 'Complete el formulario y nuestro equipo se pondrá en contacto para orientarle en el proceso más adecuado para su caso.',
                   en: 'Fill in the form and our team will contact you to guide you through the right process for your case.',
                   fr: 'Remplissez le formulaire et notre équipe vous contactera pour vous orienter vers la démarche adaptée à votre cas.' },
    pais:        { pt: 'País de origem', es: 'País de origen', en: 'Country of origin', fr: "Pays d'origine" },
    paisSel:     { pt: 'Selecione o país', es: 'Seleccione el país', en: 'Select your country', fr: 'Choisissez le pays' },
    paisOutro:   { pt: 'Outro', es: 'Otro', en: 'Other', fr: 'Autre' },
    rnm:         { pt: 'Você possui RNM (Registro Nacional Migratório)?', es: '¿Tiene RNM (Registro Nacional Migratorio)?', en: 'Do you have an RNM (National Migration Registry card)?', fr: 'Avez-vous un RNM (Registre National Migratoire) ?' },
    rnmNao:      { pt: 'Não possuo', es: 'No tengo', en: "I don't have one", fr: "Je n'en ai pas" },
    rnmTemp:     { pt: 'Temporário', es: 'Temporal', en: 'Temporary', fr: 'Temporaire' },
    rnmPerm:     { pt: 'Permanente', es: 'Permanente', en: 'Permanent', fr: 'Permanent' },
    servico:     { pt: 'Qual serviço você precisa?', es: '¿Qué servicio necesita?', en: 'Which service do you need?', fr: 'De quel service avez-vous besoin ?' },
    servicoSel:  { pt: 'Selecione o serviço', es: 'Seleccione el servicio', en: 'Select a service', fr: 'Choisissez le service' },
    'srv:Naturalização Brasileira': { pt: 'Naturalização Brasileira', es: 'Naturalización brasileña', en: 'Brazilian naturalization', fr: 'Naturalisation brésilienne' },
    'srv:Naturalização Provisória (crianças/adolescentes)': { pt: 'Naturalização Provisória — crianças/adolescentes', es: 'Naturalización provisional — niños/adolescentes', en: 'Provisional naturalization — children/teens', fr: 'Naturalisation provisoire — enfants/adolescents' },
    'srv:Autorização de Residência (CPLP / Reunião Familiar / Mercosul)': { pt: 'Autorização de Residência (CPLP / Reunião Familiar / Mercosul)', es: 'Autorización de residencia (CPLP / Reunión familiar / Mercosur)', en: 'Residence authorization (CPLP / Family reunion / Mercosur)', fr: 'Autorisation de résidence (CPLP / Regroupement familial / Mercosur)' },
    'srv:Renovação de Autorização de Residência': { pt: 'Renovação de Autorização de Residência', es: 'Renovación de autorización de residencia', en: 'Residence authorization renewal', fr: "Renouvellement de l'autorisation de résidence" },
    'srv:Agendamento de Autorização de Residência': { pt: 'Agendamento de Autorização de Residência', es: 'Cita para autorización de residencia', en: 'Residence authorization appointment booking', fr: "Prise de rendez-vous pour l'autorisation de résidence" },
    'srv:Visto Americano de Turismo': { pt: 'Visto Americano de Turismo', es: 'Visa estadounidense de turismo', en: 'US tourist visa', fr: 'Visa touristique pour les États-Unis' },
    tempo:       { pt: 'Há quanto tempo você está no Brasil?', es: '¿Cuánto tiempo lleva en Brasil?', en: 'How long have you been in Brazil?', fr: 'Depuis combien de temps êtes-vous au Brésil ?' },
    'tmp:Ainda não estou no Brasil': { pt: 'Ainda não estou no Brasil', es: 'Todavía no estoy en Brasil', en: "I'm not in Brazil yet", fr: 'Je ne suis pas encore au Brésil' },
    'tmp:Menos de 6 meses': { pt: 'Menos de 6 meses', es: 'Menos de 6 meses', en: 'Less than 6 months', fr: 'Moins de 6 mois' },
    'tmp:6 a 12 meses':     { pt: '6 a 12 meses', es: '6 a 12 meses', en: '6 to 12 months', fr: '6 à 12 mois' },
    'tmp:1 a 2 anos':       { pt: '1 a 2 anos', es: '1 a 2 años', en: '1 to 2 years', fr: '1 à 2 ans' },
    'tmp:2 a 5 anos':       { pt: '2 a 5 anos', es: '2 a 5 años', en: '2 to 5 years', fr: '2 à 5 ans' },
    'tmp:Mais de 5 anos':   { pt: 'Mais de 5 anos', es: 'Más de 5 años', en: 'More than 5 years', fr: 'Plus de 5 ans' },
    cidade:      { pt: 'Cidade', es: 'Ciudad', en: 'City', fr: 'Ville' },
    cidadePh:    { pt: 'Sua cidade', es: 'Su ciudad', en: 'Your city', fr: 'Votre ville' },
    estado:      { pt: 'Estado', es: 'Estado', en: 'State', fr: 'État' },
    solicitar:   { pt: 'Solicitar atendimento', es: 'Solicitar atención', en: 'Request assistance', fr: 'Demander un accompagnement' },
    errPais:     { pt: 'Selecione o país', es: 'Seleccione el país', en: 'Select your country', fr: 'Choisissez le pays' },
    errServico:  { pt: 'Selecione o serviço', es: 'Seleccione el servicio', en: 'Select a service', fr: 'Choisissez le service' },
    errTempo:    { pt: 'Selecione o tempo', es: 'Seleccione el tiempo', en: 'Select how long', fr: 'Choisissez la durée' },
    errCidade:   { pt: 'Cidade obrigatória', es: 'Ciudad obligatoria', en: 'City is required', fr: 'Ville obligatoire' },
    errEstado:   { pt: 'Selecione o estado', es: 'Seleccione el estado', en: 'Select the state', fr: "Choisissez l'État" },
    okTitulo:    { pt: 'Recebemos seu contato!', es: '¡Recibimos su contacto!', en: 'We got your request!', fr: 'Nous avons bien reçu votre demande !' },
    okMsg:       { pt: 'Nossa equipe entrará em contato em breve pelo WhatsApp ou e-mail informado.',
                   es: 'Nuestro equipo se pondrá en contacto pronto por WhatsApp o correo electrónico.',
                   en: 'Our team will contact you soon by WhatsApp or email.',
                   fr: 'Notre équipe vous contactera bientôt par WhatsApp ou e-mail.' },

    // ── Formulário por serviço ──
    formTitulo:  { pt: 'Formulário de', es: 'Formulario de', en: 'Form:', fr: 'Formulaire :' },
    formSub:     { pt: 'Preencha o formulário e nossa equipe entrará em contato para orientar você no processo de {servico}.',
                   es: 'Complete el formulario y nuestro equipo se pondrá en contacto para orientarle en el proceso de {servico}.',
                   en: 'Fill in the form and our team will contact you to guide you through the {servico} process.',
                   fr: 'Remplissez le formulaire et notre équipe vous contactera pour vous accompagner dans la démarche : {servico}.' },
    formCarregando: { pt: 'Carregando formulário...', es: 'Cargando formulario...', en: 'Loading form...', fr: 'Chargement du formulaire...' },
    formNaoAchado:  { pt: 'Formulário não encontrado. Confira o link com quem enviou.', es: 'Formulario no encontrado. Verifique el enlace con quien se lo envió.', en: 'Form not found. Please check the link with whoever sent it.', fr: "Formulaire introuvable. Vérifiez le lien auprès de la personne qui vous l'a envoyé." },
    formOkTitulo:{ pt: 'Recebemos suas informações!', es: '¡Recibimos su información!', en: 'We received your information!', fr: 'Nous avons bien reçu vos informations !' },
    formOkMsg:   { pt: 'Nossa equipe vai analisar e entrar em contato pelo WhatsApp ou e-mail informado.',
                   es: 'Nuestro equipo la revisará y se pondrá en contacto por WhatsApp o correo electrónico.',
                   en: 'Our team will review it and contact you by WhatsApp or email.',
                   fr: 'Notre équipe va l’analyser et vous contacter par WhatsApp ou e-mail.' },

    // ── Agenda ──
    agTitulo:    { pt: 'Escolha um horário para atendimento', es: 'Elija un horario para la atención', en: 'Choose a time for your appointment', fr: 'Choisissez un créneau pour votre rendez-vous' },
    agDia:       { pt: 'Dia', es: 'Día', en: 'Day', fr: 'Jour' },
    agHora:      { pt: 'Horário', es: 'Horario', en: 'Time', fr: 'Heure' },
    agSelDia:    { pt: 'Selecione o dia', es: 'Seleccione el día', en: 'Select a day', fr: 'Choisissez le jour' },
    agSelHora:   { pt: 'Selecione o horário', es: 'Seleccione el horario', en: 'Select a time', fr: "Choisissez l'heure" },
    agEscolhaDia:{ pt: 'Escolha o dia', es: 'Elija el día', en: 'Pick a day first', fr: "Choisissez d'abord le jour" },
    agAConfirmar:{ pt: '(horário a confirmar)', es: '(horario a confirmar)', en: '(time to be confirmed)', fr: '(heure à confirmer)' },
    agEquipeConfirma: { pt: 'A equipe confirma', es: 'El equipo lo confirma', en: 'Our team will confirm', fr: "L'équipe confirme" },
    agInfo:      { pt: 'Horários de Brasília. Você recebe um e-mail para confirmar a presença.', es: 'Horario de Brasilia. Recibirá un correo para confirmar su asistencia.', en: 'Brasília time. You will get an email to confirm your attendance.', fr: 'Heure de Brasília. Vous recevrez un e-mail pour confirmer votre présence.' },
    agPular:     { pt: 'Prefiro que a equipe entre em contato para combinar', es: 'Prefiero que el equipo me contacte para coordinar', en: "I'd rather the team contacts me to arrange it", fr: "Je préfère que l'équipe me contacte pour convenir d'un horaire" },
    agErr:       { pt: 'Escolha um dia e horário (ou marque a opção de combinar com a equipe)', es: 'Elija un día y horario (o marque la opción de coordinar con el equipo)', en: 'Pick a day and time (or tick the option to arrange it with the team)', fr: "Choisissez un jour et une heure (ou cochez l'option pour convenir avec l'équipe)" },
    agOkTitulo:  { pt: 'Atendimento agendado!', es: '¡Cita agendada!', en: 'Appointment booked!', fr: 'Rendez-vous réservé !' },
    agOkMsg:     { pt: 'Enviamos um e-mail para {email}. Clique em <b>Confirmar presença</b> para garantir seu horário.',
                   es: 'Enviamos un correo a {email}. Haga clic en <b>Confirmar asistencia</b> para asegurar su horario.',
                   en: 'We sent an email to {email}. Click <b>Confirm attendance</b> to secure your time.',
                   fr: 'Nous avons envoyé un e-mail à {email}. Cliquez sur <b>Confirmer ma présence</b> pour garantir votre créneau.' },
    agOkSabado:  { pt: 'Nossa equipe vai entrar em contato para <b>confirmar o horário</b>. Enviamos os detalhes para {email}.',
                   es: 'Nuestro equipo se pondrá en contacto para <b>confirmar el horario</b>. Enviamos los detalles a {email}.',
                   en: 'Our team will contact you to <b>confirm the time</b>. We sent the details to {email}.',
                   fr: "Notre équipe vous contactera pour <b>confirmer l'heure</b>. Les détails ont été envoyés à {email}." },
    agOcupado:   { pt: 'O horário escolhido acabou de ser ocupado por outra pessoa. Nossa equipe vai entrar em contato pelo WhatsApp para combinar um novo horário.',
                   es: 'El horario elegido acaba de ser ocupado por otra persona. Nuestro equipo le contactará por WhatsApp para coordinar uno nuevo.',
                   en: 'The time you picked was just taken by someone else. Our team will contact you on WhatsApp to arrange a new one.',
                   fr: "Le créneau choisi vient d'être pris. Notre équipe vous contactera sur WhatsApp pour en convenir d'un autre." },
    agData:      { pt: 'Data', es: 'Fecha', en: 'Date', fr: 'Date' },
    agHorario:   { pt: 'Horário', es: 'Horario', en: 'Time', fr: 'Heure' },
    agHorarioBsb:{ pt: 'Horário (Brasília)', es: 'Horario (Brasilia)', en: 'Time (Brasília)', fr: 'Heure (Brasília)' },
    agTipo:      { pt: 'Tipo', es: 'Tipo', en: 'Type', fr: 'Type' },
    agPelaEquipe:{ pt: 'A confirmar pela equipe', es: 'A confirmar por el equipo', en: 'To be confirmed by our team', fr: "À confirmer par l'équipe" },

    // ── Página de confirmação ──
    cfOla:       { pt: 'Olá', es: 'Hola', en: 'Hello', fr: 'Bonjour' },
    cfSub:       { pt: 'Este é o seu atendimento com a WB Assessoria Migratória.', es: 'Esta es su cita con WB Assessoria Migratória.', en: 'This is your appointment with WB Assessoria Migratória.', fr: 'Voici votre rendez-vous avec WB Assessoria Migratória.' },
    stADefinir:  { pt: 'Horário a definir pela equipe', es: 'Horario a definir por el equipo', en: 'Time to be set by our team', fr: "Heure à définir par l'équipe" },
    stPendente:  { pt: 'Aguardando sua confirmação', es: 'Esperando su confirmación', en: 'Awaiting your confirmation', fr: 'En attente de votre confirmation' },
    stConfirmado:{ pt: 'Presença confirmada', es: 'Asistencia confirmada', en: 'Attendance confirmed', fr: 'Présence confirmée' },
    stCancelado: { pt: 'Cancelado', es: 'Cancelada', en: 'Cancelled', fr: 'Annulé' },
    cfConfirmar: { pt: '✅ Confirmar presença', es: '✅ Confirmar asistencia', en: '✅ Confirm attendance', fr: '✅ Confirmer ma présence' },
    cfReagendar: { pt: 'Reagendar', es: 'Reprogramar', en: 'Reschedule', fr: 'Reprogrammer' },
    cfCancelar:  { pt: 'Não vou poder ir — cancelar', es: 'No podré ir — cancelar', en: "I can't make it — cancel", fr: "Je ne pourrai pas venir — annuler" },
    cfNovo:      { pt: 'Escolher novo horário', es: 'Elegir nuevo horario', en: 'Choose a new time', fr: 'Choisir un nouveau créneau' },
    cfVoltar:    { pt: 'Voltar', es: 'Volver', en: 'Back', fr: 'Retour' },
    cfEscolhaNovo:{ pt: 'Escolha o novo horário', es: 'Elija el nuevo horario', en: 'Choose the new time', fr: 'Choisissez le nouveau créneau' },
    cfEscolhaDH: { pt: 'Escolha dia e horário', es: 'Elija día y horario', en: 'Pick a day and time', fr: 'Choisissez le jour et l’heure' },
    cfConfirmarEm:{ pt: 'Confirmar {data} às {hora}', es: 'Confirmar {data} a las {hora}', en: 'Confirm {data} at {hora}', fr: 'Confirmer le {data} à {hora}' },
    cfSemHorarios:{ pt: 'Não há horários livres nos próximos dias. Fale com a gente pelo WhatsApp.', es: 'No hay horarios libres en los próximos días. Escríbanos por WhatsApp.', en: 'No times available in the coming days. Please contact us on WhatsApp.', fr: 'Aucun créneau libre dans les prochains jours. Contactez-nous sur WhatsApp.' },
    cfPassou:    { pt: 'Este horário já passou. Para um novo atendimento, fale com a gente pelo WhatsApp.', es: 'Este horario ya pasó. Para una nueva cita, escríbanos por WhatsApp.', en: 'This time has already passed. For a new appointment, contact us on WhatsApp.', fr: 'Ce créneau est déjà passé. Pour un nouveau rendez-vous, contactez-nous sur WhatsApp.' },
    cfAguardaEquipe: { pt: 'Nossa equipe vai definir o horário e te avisar por e-mail para você confirmar.', es: 'Nuestro equipo definirá el horario y le avisará por correo para que lo confirme.', en: 'Our team will set the time and email you so you can confirm.', fr: "Notre équipe fixera l'heure et vous préviendra par e-mail pour que vous confirmiez." },
    cfOkConfirmado: { pt: 'Obrigado! Sua presença está confirmada. Até lá!', es: '¡Gracias! Su asistencia está confirmada. ¡Hasta pronto!', en: 'Thank you! Your attendance is confirmed. See you then!', fr: 'Merci ! Votre présence est confirmée. À bientôt !' },
    cfOkCancelado:  { pt: 'Atendimento cancelado. Se quiser, escolha um novo horário.', es: 'Cita cancelada. Si quiere, elija un nuevo horario.', en: 'Appointment cancelled. You can choose a new time if you like.', fr: 'Rendez-vous annulé. Vous pouvez choisir un nouveau créneau.' },
    cfOkReagendado: { pt: 'Pronto! Seu novo horário está confirmado.', es: '¡Listo! Su nuevo horario está confirmado.', en: 'Done! Your new time is confirmed.', fr: 'C’est fait ! Votre nouveau créneau est confirmé.' },
    cfCertezaCancelar: { pt: 'Tem certeza que deseja cancelar este atendimento?', es: '¿Seguro que desea cancelar esta cita?', en: 'Are you sure you want to cancel this appointment?', fr: 'Voulez-vous vraiment annuler ce rendez-vous ?' },
    cfNaoAchado: { pt: 'Agendamento não encontrado', es: 'Cita no encontrada', en: 'Appointment not found', fr: 'Rendez-vous introuvable' },
    cfNaoAchadoMsg: { pt: 'O link pode estar incompleto. Fale com a gente pelo WhatsApp que ajudamos você.', es: 'El enlace puede estar incompleto. Escríbanos por WhatsApp y le ayudamos.', en: 'The link may be incomplete. Contact us on WhatsApp and we will help.', fr: 'Le lien est peut-être incomplet. Contactez-nous sur WhatsApp, nous vous aiderons.' },
    cfDuvidas:   { pt: 'Dúvidas? Fale conosco pelo WhatsApp', es: '¿Dudas? Escríbanos por WhatsApp', en: 'Questions? Chat with us on WhatsApp', fr: 'Des questions ? Écrivez-nous sur WhatsApp' },
    'tipo:Consulta inicial': { pt: 'Consulta inicial', es: 'Consulta inicial', en: 'Initial consultation', fr: 'Consultation initiale' },
    cfErro:      { pt: 'Algo deu errado. Tente novamente.', es: 'Algo salió mal. Intente de nuevo.', en: 'Something went wrong. Please try again.', fr: "Une erreur s'est produite. Réessayez." },
  };

  const LOCALE = { pt: 'pt-BR', es: 'es', en: 'en-US', fr: 'fr-FR' };

  function detectar() {
    const q = new URLSearchParams(location.search).get('lang');
    if (q && IDIOMAS[q]) return q;
    try { const s = localStorage.getItem('wb_lang'); if (s && IDIOMAS[s]) return s; } catch {}
    const nav = (navigator.language || 'pt').slice(0, 2).toLowerCase();
    return IDIOMAS[nav] ? nav : 'pt';
  }

  let lang = detectar();
  const t = (k, vars) => {
    let s = (T[k] && (T[k][lang] ?? T[k].pt)) ?? k;
    if (vars) for (const [a, b] of Object.entries(vars)) s = s.split('{' + a + '}').join(b);
    return s;
  };

  // Aplica textos em elementos marcados: data-i18n (texto), data-i18n-html,
  // data-i18n-ph (placeholder)
  function aplicar(raiz = document) {
    raiz.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    raiz.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
    raiz.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    document.documentElement.lang = LOCALE[lang];
  }

  // Seletor de idioma (canto superior direito)
  function seletor(aoTrocar) {
    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;top:14px;right:14px;z-index:10';
    const sel = document.createElement('select');
    sel.setAttribute('aria-label', 'Idioma / Language');
    sel.style.cssText = 'width:auto;background:#111;border:1px solid #333;color:#e5e5e5;border-radius:8px;padding:6px 10px;font-size:13px;font-family:inherit;cursor:pointer';
    sel.innerHTML = Object.entries(IDIOMAS).map(([k, v]) => `<option value="${k}"${k === lang ? ' selected' : ''}>🌐 ${v}</option>`).join('');
    sel.addEventListener('change', () => {
      lang = sel.value;
      try { localStorage.setItem('wb_lang', lang); } catch {}
      aplicar();
      aoTrocar && aoTrocar(lang);
    });
    box.appendChild(sel);
    document.body.style.position = 'relative';
    document.body.appendChild(box);
  }

  function dataLonga(iso) {
    const s = new Date(iso + 'T12:00:00').toLocaleDateString(LOCALE[lang], { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function dataCurta(iso) {
    const s = new Date(iso + 'T12:00:00').toLocaleDateString(LOCALE[lang], { weekday: 'short', day: 'numeric', month: 'short' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  // Nome do país no idioma escolhido (via código ISO); cai no texto original
  function nomePais(iso, original) {
    try { return new Intl.DisplayNames([LOCALE[lang]], { type: 'region' }).of(iso) || original; } catch { return original; }
  }

  const tipo = (x) => (T['tipo:' + x] ? t('tipo:' + x) : x);

  window.WBI18N = { tipo, t, aplicar, seletor, dataLonga, dataCurta, nomePais, get lang() { return lang; } };
})();
