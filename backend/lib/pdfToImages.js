// Converte páginas de um PDF em imagens PNG (Buffer) — usado para mandar
// documentos em PDF pra modelos de IA que só leem imagem (ex: Groq vision).
// pdf-to-img é ESM-only, por isso o import() dinâmico.
async function pdfParaImagensPng(buffer, maxPaginas = 3, scale = 2) {
  const { pdf } = await import('pdf-to-img');
  const doc = await pdf(buffer, { scale });
  const imagens = [];
  for await (const imagem of doc) {
    imagens.push(imagem);
    if (imagens.length >= maxPaginas) break;
  }
  await doc.destroy();
  return imagens;
}

module.exports = { pdfParaImagensPng };
