// Trava defensiva — equivalente leve ao pacote `server-only`, sem dependência.
//
// Qualquer módulo que toque em credenciais ou no banco (db/index.ts,
// lib/auth/server.ts) importa isto. Se um dia esse módulo for parar no bundle
// do navegador (ex.: importado por engano em um componente "use client"), a
// avaliação abaixo lança — falha ruidosa e imediata em vez de embarcar código
// de servidor no front-end.
//
// O isolamento real já é garantido pelo Next (Server Actions/RSC não sobem pro
// cliente, e env sem prefixo NEXT_PUBLIC não é exposta). Isto é defesa em
// profundidade: transforma um erro silencioso em um erro óbvio.
if (typeof window !== "undefined") {
  throw new Error(
    "Módulo restrito ao servidor foi importado no cliente. Credenciais e acesso " +
      "ao banco de dados nunca podem ir para o navegador.",
  );
}

export {};
