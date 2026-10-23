// Traduções dos formulários públicos (espanhol, inglês, francês).
// Só muda o que o CLIENTE vê: as respostas continuam sendo gravadas com a
// pergunta e a opção em português, pra equipe ler tudo igual no Pipeline.
// Pergunta sem tradução aqui aparece em português (nunca quebra).

// Opções de resposta (valor gravado em português → texto exibido)
const OPCOES = {
  'Sim':            { es: 'Sí', en: 'Yes', fr: 'Oui' },
  'Não':            { es: 'No', en: 'No', fr: 'Non' },
  'Permanente':     { es: 'Permanente', en: 'Permanent', fr: 'Permanent' },
  'Temporário':     { es: 'Temporal', en: 'Temporary', fr: 'Temporaire' },
  'Ainda não tem':  { es: 'Todavía no tengo', en: "I don't have one yet", fr: "Je n'en ai pas encore" },
  'Não preciso (tenho vínculo brasileiro)': { es: 'No lo necesito (tengo vínculo brasileño)', en: "I don't need it (I have a Brazilian family tie)", fr: "Pas nécessaire (j'ai un lien familial brésilien)" },
  'Não tenho filho brasileiro': { es: 'No tengo hijo brasileño', en: "I don't have a Brazilian child", fr: "Je n'ai pas d'enfant brésilien" },
  'Não sou casado(a)': { es: 'No estoy casado(a)', en: "I'm not married", fr: 'Je ne suis pas marié(e)' },
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
      { es: '03 · Documentos que ya tiene', en: '03 · Documents you already have', fr: '03 · Documents que vous avez déjà' },
      { es: '04 · Próximos pasos', en: '04 · Next steps', fr: '04 · Prochaines étapes' },
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
      doc_rnm:            { es: 'RNM/RNE', en: 'RNM/RNE', fr: 'RNM/RNE' },
      doc_cpf:            { es: 'CPF', en: 'CPF', fr: 'CPF' },
      doc_endereco:       { es: 'Comprobante de domicilio actualizado', en: 'Recent proof of address', fr: 'Justificatif de domicile récent' },
      doc_passaporte:     { es: 'Pasaporte / documento de entrada al país', en: 'Passport / entry document', fr: "Passeport / document d'entrée au pays" },
      doc_4anos:          { es: 'Comprobantes de los últimos 4 años en Brasil', en: 'Proof of the last 4 years in Brazil', fr: 'Justificatifs des 4 dernières années au Brésil' },
      doc_antecedente:    { es: 'Antecedentes penales del país de origen (apostillados)', en: 'Criminal record certificate from your home country (apostilled)', fr: "Casier judiciaire du pays d'origine (apostillé)" },
      doc_antecedente_validade: { es: 'Vencimiento de los antecedentes penales', en: 'Criminal record certificate expiry date', fr: "Date d'expiration du casier judiciaire",
        dica: { es: 'Solo si ya tiene los antecedentes apostillados.', en: 'Only if you already have the apostilled certificate.', fr: 'Seulement si vous avez déjà le casier apostillé.' } },
      doc_portugues:      { es: 'Certificado de lengua portuguesa', en: 'Portuguese language certificate', fr: 'Certificat de langue portugaise' },
      doc_prova:          { es: 'Certificado de examen presencial', en: 'In-person exam certificate', fr: "Certificat d'examen en présentiel" },
      doc_filho:          { es: 'Acta de nacimiento o RG del hijo brasileño', en: "Brazilian child's birth certificate or ID (RG)", fr: "Acte de naissance ou RG de l'enfant brésilien" },
      doc_casamento:      { es: 'Acta de matrimonio o unión estable', en: 'Marriage or common-law certificate', fr: "Acte de mariage ou d'union libre" },
      doc_trabalho:       { es: 'Libreta de trabajo / CNPJ', en: 'Work card (Carteira de Trabalho) / CNPJ', fr: 'Carnet de travail (Carteira de Trabalho) / CNPJ' },
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
          for (const lang of ['es', 'en', 'fr']) {
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

module.exports = { FORMULARIOS_I18N, OPCOES, comTraducoes };
