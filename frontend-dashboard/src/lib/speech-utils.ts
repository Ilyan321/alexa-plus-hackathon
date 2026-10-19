// Strip <thinking>...</thinking> blocks that Nova Pro sometimes emits
export const stripThinking = (text: string): string => {
  const stripped = text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
  if (!stripped && text.includes('<thinking>')) {
    const matches = Array.from(text.matchAll(/<thinking>([\s\S]*?)<\/thinking>/g));
    const last = matches[matches.length - 1]?.[1]?.trim();
    if (last) {
      return last.replace(/RenderServerTarget___\w+/g, 'sensor gateway');
    }
  }
  return stripped || text || 'Analysis complete.';
};

// Parse deviation value from a text string
export const parseDeviation = (text: string): number | null => {
  const m =
    text.match(/(?:measured|current|reading|deviation(?: of| is|:)?|specifically at)\s*(\d+(?:\.\d+)?)\s*micron/i) ||
    text.match(/(\d+(?:\.\d+)?)\s*micron/i);
  return m ? parseFloat(m[1]) : null;
};

// Format feature ID or acronyms for natural SpeechSynthesis so TTS does not spell them out letter-by-letter
export const formatSpokenPronunciation = (str: string): string => {
  return str
    .replace(/\bUPPER_FLANGE\b/g, 'Upper Flange')
    .replace(/\bMAIN_BORE_HOLE\b/g, 'Main Bore Hole')
    .replace(/\bTURBINE_BLADE_ROOT\b/g, 'Turbine Blade Root')
    .replace(/\bINLET_NOZZLE_RING\b/g, 'Inlet Nozzle Ring')
    .replace(/\bEXHAUST_STATOR_BOSS\b/g, 'Exhaust Stator Boss')
    .replace(/\bCNC\b/g, 'C N C')
    .replace(/\bNOMINAL\b/g, 'Nominal')
    .replace(/\bOUT OF TOLERANCE\b/g, 'Out of tolerance')
    .replace(/\bWITHIN TOLERANCE\b/g, 'Within tolerance')
    .replace(/\b([A-Z]{2,})\b/g, (match) => {
      // Convert any other all-caps words (e.g. RPM, VERDICT) to Title case unless standard 3-letter acronym
      if (match === 'RPM' || match === 'CMM' || match === 'DMO') return match;
      return match.charAt(0) + match.slice(1).toLowerCase();
    })
    .replace(/_/g, ' ');
};

// Dynamically convert AgentCore's generated analysis into natural spoken speech without hardcoded placeholders
export const formatAgentCoreSpokenText = (text: string): string => {
  if (!text) return '';

  const spoken = text
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '') // strip internal thoughts
    .replace(/```[\s\S]*?```/g, '') // strip raw multiline code blocks (e.g. raw G-code) so TTS stays fluid
    .replace(/`([^`]+)`/g, '$1') // unwrap inline code
    .replace(/\*\*|__|[*_]/g, ' ') // strip bold/italics
    .replace(/^#+\s+/gm, '') // strip markdown header tags
    .replace(/^\s*[-*•]\s+/gm, '') // strip bullet dashes
    .replace(/\|[^\n]+\|/g, ' ') // strip table borders
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // unwrap links
    // Convert units and technical acronyms for clear spoken phonetics
    .replace(/(\d+(?:\.\d+)?)\s*mm\b/gi, '$1 millimeters')
    .replace(/(\d+(?:\.\d+)?)\s*µm\b/gi, '$1 microns')
    .replace(/M24\b/g, 'M 24')
    .replace(/\bUPPER_FLANGE\b/g, 'Upper Flange')
    .replace(/\bMAIN_BORE_HOLE\b/g, 'Main Bore Hole')
    .replace(/\bTURBINE_BLADE_ROOT\b/g, 'Turbine Blade Root')
    .replace(/\bINLET_NOZZLE_RING\b/g, 'Inlet Nozzle Ring')
    .replace(/\bEXHAUST_STATOR_BOSS\b/g, 'Exhaust Stator Boss')
    .replace(/\bCNC\b/g, 'C N C')
    .replace(/\bRPM\b/g, 'R P M')
    .replace(/\bCMM\b/g, 'C M M')
    .replace(/\bNOMINAL\b/g, 'Nominal')
    .replace(/\bOUT OF TOLERANCE\b/g, 'Out of tolerance')
    .replace(/\bWITHIN TOLERANCE\b/g, 'Within tolerance')
    .replace(/_/g, ' ')
    // Convert remaining all-caps words to Title Case unless standard 3-letter acronym
    .replace(/\b([A-Z]{2,})\b/g, (match) => {
      if (match === 'R P M' || match === 'C M M' || match === 'C N C' || match === 'DMO') return match;
      return match.charAt(0) + match.slice(1).toLowerCase();
    })
    .replace(/\s+/g, ' ')
    .trim();

  return spoken;
};

// Normalize phonetic variations and accent pronunciations to exact aerospace metrology terms
export const normalizeAcousticSpeech = (rawText: string): string => {
  let text = rawText;

  // Upper Flange phonetics (e.g. "aper falnge", "upper flang", "up per plange", "oper flange")
  text = text.replace(/\b(upper|aper|oper|apir|up\s*per|apa)\s*(flange|falnge|flang|flanje|plange|plang|plant|french|flange)\b/gi, 'UPPER_FLANGE');
  text = text.replace(/\b(aper\s*falnge|upper\s*falnge|aper\s*flange)\b/gi, 'UPPER_FLANGE');
  text = text.replace(/\bupper\s*fl\w*\b/gi, 'UPPER_FLANGE');

  // Main Bore Hole phonetics (e.g. "main bore", "mane boor hole", "manhole board", "manhole")
  text = text.replace(/\b(main|mane|men|mine|man)\s*(bore|boar|boor|pour|four|pore)?\s*(hole|whole|hall|hold|board)?\b/gi, (match) => {
    if (/man\s*hole|manhole|main\s*bore|mane\s*boor|bore\s*hole/i.test(match)) {
      return 'MAIN_BORE_HOLE';
    }
    return match;
  });
  text = text.replace(/\b(manhole|man\s*hole|main\s*board)\b/gi, 'MAIN_BORE_HOLE');
  text = text.replace(/\bMAIN_BORE_HOLE\s*(board|hole|bore)\b/gi, 'MAIN_BORE_HOLE');
  text = text.replace(/\bm\s*a\s*i\s*n\s*b\s*o\s*r\s*e(\s*h\s*o\s*l\s*e)?\b/gi, 'MAIN_BORE_HOLE');
  text = text.replace(/\b(main\s*bore|bore\s*hole)\b/gi, 'MAIN_BORE_HOLE');

  // Turbine Blade Root phonetics (e.g. "turbin blade root", "tarbine plate wood")
  text = text.replace(/\b(turbine|turbin|tarbine|turb|terbine)\s*(blade|blad|plate)?\s*(root|rout|route|wood|rud)?\b/gi, 'TURBINE_BLADE_ROOT');
  text = text.replace(/\bblade\s*root\b/gi, 'TURBINE_BLADE_ROOT');

  // Inlet Nozzle Ring phonetics (e.g. "inlet nozzle", "inlett nosel ring")
  text = text.replace(/\b(inlet|inlett|in\s*let)\s*(nozzle|nosel|nozel|nasal|nuzzle)?\s*(ring|wring)?\b/gi, 'INLET_NOZZLE_RING');
  text = text.replace(/\bnozzle\s*ring\b/gi, 'INLET_NOZZLE_RING');

  // Exhaust Stator Boss phonetics (e.g. "exaust stator boss", "igzost starter base")
  text = text.replace(/\b(exhaust|exaust|igzost|egzost)\s*(stator|stater|starter)?\s*(boss|bose|base|pos)?\b/gi, 'EXHAUST_STATOR_BOSS');
  text = text.replace(/\bstator\s*boss\b/gi, 'EXHAUST_STATOR_BOSS');

  // Procedural conversational shortcuts (e.g. "proceed repair", "yes", "retrieve repair procedure")
  if (/^\s*(yes|yeah|yep|sure|proceed|fix\s*it|do\s*it|ok|okay)\.?\s*$/i.test(text.trim())) {
    return 'Yes, retrieve the CNC repair procedure.';
  }
  if (/\b(proceed\s*repair|proceed\s*with\s*repair|retrieve\s*repair|start\s*repair|repair\s*now)\b/i.test(text)) {
    return 'Yes, retrieve the CNC repair procedure.';
  }
  if (/\b(yes|yeah|yep|sure|proceed)\b.*\b(repair|procedure|fix)\b/i.test(text)) {
    return 'Yes, retrieve the CNC repair procedure.';
  }

  return text;
};
