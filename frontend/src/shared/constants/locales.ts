import type { CountryCode } from "../../features/chat/types/semantic";

export interface CountryLocale {
  code: CountryCode;
  speechLocale: string;
  welcomeGreeting: (name: string) => string;
  placeholder: string;
  sendLabel: string;
  prompts: Record<string, string[]>;
}

const defaultEnglishPrompts = {
  metadata_stats_linear: [
    "Which content has missing metadata fields?",
    "Show linear metadata completeness by genre",
    "List top metadata issues affecting search",
  ],
  imagerystats_vod: [
    "Which titles are missing poster or hero images?",
    "Show image asset readiness by market",
    "List titles with missing visual assets by priority",
  ],
  mapping_stats_svc: [
    "How long are provider imports taking today?",
    "Which sources have processing bottlenecks?",
    "Show match rates and delay trends by provider",
  ],
  schedule_completeness_tsg: [
    "Are there any 'TBA' slots in tomorrow's schedule?",
    "Show schedule completeness for next week",
    "Where are the largest schedule coverage gaps?",
  ],
  program_gaps_svc: [
    "Which contracted shows are missing from the platform?",
    "Compare contract show counts against live titles",
    "List missing programs by provider and country",
  ],
  linear_country_grading: [
    "Show overall report card grades by country",
    "Which countries are below target health grade?",
    "Compare overall market grades this month",
  ],
  usage_metrics_bia_dashboards: [
    "Which dashboards have the highest active logins?",
    "Show client engagement trends by country",
    "Identify accounts with low dashboard usage",
  ],
};

export const countryLocales: Record<CountryCode, CountryLocale> = {
  US: {
    code: "US",
    speechLocale: "en-US",
    welcomeGreeting: (name) => `Hello, ${name}! How can I help you today?`,
    placeholder: "Ask me about TV shows and movies",
    sendLabel: "Send",
    prompts: defaultEnglishPrompts,
  },
  CA: {
    code: "CA",
    speechLocale: "en-CA",
    welcomeGreeting: (name) => `Hello, ${name}! How can I help you today?`,
    placeholder: "Ask me about TV shows and movies",
    sendLabel: "Send",
    prompts: defaultEnglishPrompts,
  },
  GB: {
    code: "GB",
    speechLocale: "en-GB",
    welcomeGreeting: (name) => `Hello, ${name}! How can I assist you today?`,
    placeholder: "Ask me about TV shows and programmes",
    sendLabel: "Send",
    prompts: defaultEnglishPrompts,
  },
  AU: {
    code: "AU",
    speechLocale: "en-AU",
    welcomeGreeting: (name) => `G'day, ${name}! How can I help you today?`,
    placeholder: "Ask me about TV shows and movies",
    sendLabel: "Send",
    prompts: defaultEnglishPrompts,
  },
  ES: {
    code: "ES",
    speechLocale: "es-ES",
    welcomeGreeting: (name) => `¡Hola, ${name}! ¿Cómo puedo ayudarte hoy?`,
    placeholder: "Pregúntame sobre series de TV y películas",
    sendLabel: "Enviar",
    prompts: {
      metadata_stats_linear: [
        "¿Qué contenidos tienen campos de metadatos faltantes?",
        "Mostrar integridad de metadatos por género",
        "Listar principales problemas de metadatos que afectan las búsquedas",
      ],
      imagerystats_vod: [
        "¿Qué títulos no tienen póster o imagen principal?",
        "Mostrar preparación de imágenes por mercado",
        "Listar títulos con imágenes faltantes por prioridad",
      ],
      mapping_stats_svc: [
        "¿Cuánto tardan hoy las importaciones de los proveedores?",
        "¿Qué fuentes tienen cuellos de botella en el procesamiento?",
        "Mostrar tasas de coincidencia y tendencias de demora por proveedor",
      ],
      schedule_completeness_tsg: [
        "¿Hay espacios 'TBA' en la programación de mañana?",
        "Mostrar integridad de la programación para la próxima semana",
        "¿Dónde están las mayores brechas de cobertura de programación?",
      ],
      program_gaps_svc: [
        "¿Qué programas contratados faltan en la plataforma?",
        "Comparar recuento de programas contratados frente a títulos en vivo",
        "Listar programas faltantes por proveedor y país",
      ],
      linear_country_grading: [
        "Mostrar calificaciones generales por país",
        "¿Qué países están por debajo del objetivo de calificación?",
        "Comparar calificaciones de mercado de este mes",
      ],
      usage_metrics_bia_dashboards: [
        "¿Qué paneles tienen la mayor cantidad de inicios de sesión activos?",
        "Mostrar tendencias de participación del cliente por país",
        "Identificar cuentas con bajo uso del panel",
      ],
    },
  },
  BR: {
    code: "BR",
    speechLocale: "pt-BR",
    welcomeGreeting: (name) => `Olá, ${name}! Como posso ajudar você hoje?`,
    placeholder: "Pergunte-me sobre programas de TV e filmes",
    sendLabel: "Enviar",
    prompts: {
      metadata_stats_linear: [
        "Quais conteúdos estão com campos de metadados ausentes?",
        "Mostrar integridade dos metadados lineares por gênero",
        "Listar principais problemas de metadados que afetam a busca",
      ],
      imagerystats_vod: [
        "Quais títulos estão sem pôster ou imagem principal?",
        "Mostrar prontidão de imagens por mercado",
        "Listar títulos com imagens ausentes por prioridade",
      ],
      mapping_stats_svc: [
        "Quanto tempo as importações de provedores estão levando hoje?",
        "Quais fontes têm gargalos de processamento?",
        "Mostrar taxas de correspondência e atrasos por provedor",
      ],
      schedule_completeness_tsg: [
        "Existem horários 'TBA' na programação de amanhã?",
        "Mostrar integridade da programação para a próxima semana",
        "Onde estão as maiores lacunas de cobertura de programação?",
      ],
      program_gaps_svc: [
        "Quais programas contratados estão faltando na plataforma?",
        "Comparar contagem de programas contratados com títulos ao vivo",
        "Listar programas ausentes por provedor e país",
      ],
      linear_country_grading: [
        "Mostrar notas de boletim por país",
        "Quais países estão abaixo da meta de nota de saúde?",
        "Comparar notas dos mercados este mês",
      ],
      usage_metrics_bia_dashboards: [
        "Quais painéis têm mais acessos ativos?",
        "Mostrar tendências de engajamento do cliente por país",
        "Identificar contas com baixo uso do painel",
      ],
    },
  },
  FR: {
    code: "FR",
    speechLocale: "fr-FR",
    welcomeGreeting: (name) => `Bonjour, ${name} ! Comment puis-je vous aider aujourd'hui ?`,
    placeholder: "Posez-moi des questions sur les films et séries",
    sendLabel: "Envoyer",
    prompts: defaultEnglishPrompts,
  },
  DE: {
    code: "DE",
    speechLocale: "de-DE",
    welcomeGreeting: (name) => `Hallo, ${name}! Wie kann ich Ihnen heute helfen?`,
    placeholder: "Fragen Sie mich nach Fernsehsendungen und Filmen",
    sendLabel: "Senden",
    prompts: defaultEnglishPrompts,
  },
  MX: {
    code: "MX",
    speechLocale: "es-MX",
    welcomeGreeting: (name) => `¡Hola, ${name}! ¿En qué te puedo ayudar hoy?`,
    placeholder: "Pregúntame sobre programas de TV y películas",
    sendLabel: "Enviar",
    prompts: defaultEnglishPrompts,
  },
  JP: {
    code: "JP",
    speechLocale: "ja-JP",
    welcomeGreeting: (name) => `こんにちは、${name}さん！本日はどのようなご用件でしょうか？`,
    placeholder: "TV番組や映画について質問してください",
    sendLabel: "送信",
    prompts: defaultEnglishPrompts,
  },
  KR: {
    code: "KR",
    speechLocale: "ko-KR",
    welcomeGreeting: (name) => `안녕하세요, ${name}님! 오늘 어떤 도움이 필요하신가요?`,
    placeholder: "TV 프로그램 및 영화에 대해 문의하세요",
    sendLabel: "전송",
    prompts: defaultEnglishPrompts,
  },
  NL: {
    code: "NL",
    speechLocale: "nl-NL",
    welcomeGreeting: (name) => `Hallo, ${name}! Hoe kan ik je vandaag helpen?`,
    placeholder: "Vraag me over tv-programma's en films",
    sendLabel: "Versturen",
    prompts: defaultEnglishPrompts,
  },
  SE: {
    code: "SE",
    speechLocale: "sv-SE",
    welcomeGreeting: (name) => `Hej, ${name}! Hur kan jag hjälpa dig idag?`,
    placeholder: "Fråga mig om TV-program och filmer",
    sendLabel: "Skicka",
    prompts: defaultEnglishPrompts,
  },
  BE: {
    code: "BE",
    speechLocale: "nl-BE",
    welcomeGreeting: (name) => `Hallo, ${name}! Hoe kan ik je vandaag helpen?`,
    placeholder: "Vraag me over tv-programma's en films",
    sendLabel: "Versturen",
    prompts: defaultEnglishPrompts,
  },
  CH: {
    code: "CH",
    speechLocale: "de-CH",
    welcomeGreeting: (name) => `Grüezi, ${name}! Wie kann ich Ihnen heute helfen?`,
    placeholder: "Fragen Sie mich nach TV-Sendungen und Filmen",
    sendLabel: "Senden",
    prompts: defaultEnglishPrompts,
  },
  NO: {
    code: "NO",
    speechLocale: "nb-NO",
    welcomeGreeting: (name) => `Hei, ${name}! Hvordan kan jeg hjelpe deg i dag?`,
    placeholder: "Spør meg om TV-serier og filmer",
    sendLabel: "Send",
    prompts: defaultEnglishPrompts,
  },
  FI: {
    code: "FI",
    speechLocale: "fi-FI",
    welcomeGreeting: (name) => `Hei, ${name}! Kuinka voin auttaa sinua tänään?`,
    placeholder: "Kysy minulta TV-ohjelmista ja elokuvista",
    sendLabel: "Lähetä",
    prompts: defaultEnglishPrompts,
  },
  IE: {
    code: "IE",
    speechLocale: "en-IE",
    welcomeGreeting: (name) => `Hello, ${name}! How can I help you today?`,
    placeholder: "Ask me about TV shows and movies",
    sendLabel: "Send",
    prompts: defaultEnglishPrompts,
  },
  IT: {
    code: "IT",
    speechLocale: "it-IT",
    welcomeGreeting: (name) => `Ciao, ${name}! Come posso aiutarti oggi?`,
    placeholder: "Chiedimi di programmi TV e film",
    sendLabel: "Invia",
    prompts: defaultEnglishPrompts,
  },
};

export function getCountryLocale(countryCode: CountryCode): CountryLocale {
  const code = (countryCode?.toUpperCase() ?? "US") as CountryCode;
  return countryLocales[code] ?? countryLocales.US;
}
