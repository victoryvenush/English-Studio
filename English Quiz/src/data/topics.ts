export type Category = 'Grammar' | 'Vocabulary';

export interface Topic {
  id: string;
  title: string;
  short: string;
  category: Category;
  description: string;
  lesson: string;
  examples: string[];
  mistake: string;
  practice: { question: string; options: string[]; answer: string; explanation: string };
  cards: { front: string; back: string }[];
}

export const topics: Topic[] = [
  {
    id: 'relative-pronouns', title: 'Combining Sentences with Relative Pronouns', short: 'Relative Pronouns', category: 'Grammar',
    description: 'Bring ideas together beautifully.',
    lesson: 'Relative pronouns connect a describing clause to a noun. Use who for people, which for things, whose for possession, and that for people or things in defining clauses.',
    examples: ['The girl who won the race is my friend.', 'This is the book that I borrowed.'],
    mistake: 'Do not repeat the subject: say "the boy who lives here", not "the boy who he lives here".',
    practice: { question: 'The teacher ___ helped me is kind.', options: ['who', 'which', 'whose', 'where'], answer: 'who', explanation: 'Who refers to the person, the teacher.' },
    cards: [{ front: 'Which relative pronoun refers to a person?', back: 'Who. Example: The boy who sings is my brother.' }, { front: 'What does "whose" express?', back: 'Possession. Example: The girl whose bag is red is Ana.' }, { front: 'Combine: I found a pen. It is blue.', back: 'I found a pen that is blue. "That" connects the clause to pen.' }],
  },
  {
    id: 'voice', title: 'Active and Passive Voice', short: 'Active & Passive Voice', category: 'Grammar',
    description: 'See a sentence from another angle.',
    lesson: 'In active voice the subject performs the action. In passive voice the receiver becomes the subject: use the appropriate form of be followed by the past participle.',
    examples: ['Active: The artist painted the mural.', 'Passive: The mural was painted by the artist.'],
    mistake: 'Keep the original tense: "wrote" becomes "was written", not "is written".',
    practice: { question: 'Choose the passive form of "They clean the room."', options: ['The room is cleaned.', 'The room was cleaning.', 'The room cleans.', 'The room has clean.'], answer: 'The room is cleaned.', explanation: 'The present simple passive is am/is/are plus the past participle.' },
    cards: [{ front: 'What is the basic passive structure?', back: 'A form of be + past participle, for example "was made".' }, { front: 'Change to passive: She writes a letter.', back: 'A letter is written by her.' }, { front: 'When can "by the doer" be omitted?', back: 'When the doer is unknown, obvious, or unimportant.' }],
  },
  {
    id: 'speech', title: 'Direct and Indirect Speech', short: 'Direct & Indirect Speech', category: 'Grammar',
    description: 'Tell the story in your own words.',
    lesson: 'Direct speech quotes the exact words. Indirect speech reports the meaning, often changing pronouns, time words and verb tense when the reporting verb is in the past.',
    examples: ['Direct: Mia said, "I am tired."', 'Indirect: Mia said that she was tired.'],
    mistake: 'Reported statements use statement word order: "He asked where I lived", not "where did I live".',
    practice: { question: 'Report: Ravi said, "I am happy."', options: ['Ravi said that he was happy.', 'Ravi said that I am happy.', 'Ravi said that he is be happy.', 'Ravi said that was he happy.'], answer: 'Ravi said that he was happy.', explanation: 'Change I to he and am to was after the past reporting verb.' },
    cards: [{ front: 'What often happens to present tense in reported speech?', back: 'It usually shifts back after a past reporting verb: "am" becomes "was".' }, { front: 'Report: "I will go," she said.', back: 'She said that she would go.' }, { front: 'How does "today" often change in reported speech?', back: 'It can change to "that day", depending on the reporting context.' }],
  },
  {
    id: 'prepositions', title: 'Prepositions', short: 'Prepositions', category: 'Grammar',
    description: 'Find just the right connection.',
    lesson: 'Prepositions show relationships such as time, place and direction. Use at for a point, on for a surface or day, and in for an enclosed space or longer period.',
    examples: ['The lesson starts at nine on Monday.', 'The keys are in the box.'],
    mistake: 'Avoid using "in" with a specific day: say "on Friday", not "in Friday".',
    practice: { question: 'We have English class ___ Monday.', options: ['on', 'in', 'at', 'by'], answer: 'on', explanation: 'Use on with days of the week.' },
    cards: [{ front: 'Which preposition is used with clock times?', back: 'At: at 8 o\'clock.' }, { front: 'Which preposition is used with months?', back: 'In: in August.' }, { front: 'Complete: The cat is ___ the table.', back: 'On, if it is resting on the surface of the table.' }],
  },
  {
    id: 'editing', title: 'Editing Passages and Error Correction', short: 'Editing & Correction', category: 'Grammar',
    description: 'Make every sentence shine.',
    lesson: 'Edit systematically: check subject-verb agreement, tense, articles, prepositions, punctuation and spelling. Read the whole passage before correcting a single sentence.',
    examples: ['Incorrect: She go to school daily.', 'Correct: She goes to school daily.'],
    mistake: 'Do not change a correct word just because another form sounds familiar. Read the full context.',
    practice: { question: 'Which sentence is correct?', options: ['Each student has a book.', 'Each student have a book.', 'Each students has a book.', 'Each student having a book.'], answer: 'Each student has a book.', explanation: 'Each student is singular, so it takes has.' },
    cards: [{ front: 'What should you check first when editing a passage?', back: 'Read for meaning, then check grammar, punctuation and spelling in context.' }, { front: 'Correct: He don\'t like tea.', back: 'He doesn\'t like tea. A singular subject takes does not.' }, { front: 'Correct: The children was happy.', back: 'The children were happy. Children is plural.' }],
  },
  {
    id: 'tenses', title: 'Tenses and Verb Forms', short: 'Tenses & Verb Forms', category: 'Grammar',
    description: 'Put every action in its time.',
    lesson: 'Verb tenses place actions in time. Simple forms describe habits or completed events; continuous forms show actions in progress; perfect forms connect one time to another.',
    examples: ['She walks to school every day.', 'They have finished their homework.'],
    mistake: 'Use the past simple with a finished past time: "I saw her yesterday", not "I have seen her yesterday".',
    practice: { question: 'By the time we arrived, the film ___.', options: ['had started', 'starts', 'is starting', 'has start'], answer: 'had started', explanation: 'The past perfect shows an action completed before another past action.' },
    cards: [{ front: 'What does the present simple often describe?', back: 'Habits, routines and general truths: She reads every day.' }, { front: 'Form the present perfect of "finish".', back: 'Have/has finished: They have finished.' }, { front: 'When is the past perfect useful?', back: 'To show an action happened before another action in the past.' }],
  },
  {
    id: 'past-actions', title: 'Repeated Past Actions - "Used to" and "Would"', short: 'Repeated Past Actions', category: 'Grammar',
    description: 'Talk about the way things were.',
    lesson: 'Used to describes past habits and states that are no longer true. Would can describe repeated past actions, but is not normally used for past states.',
    examples: ['I used to live near the sea.', 'Every summer, we would visit our cousins.'],
    mistake: 'Avoid would for a past state: say "I used to be shy", not "I would be shy" when describing a lasting state.',
    practice: { question: 'Choose the best sentence about a past state.', options: ['I used to live in Delhi.', 'I would live in Delhi as a child state.', 'I use to lived in Delhi.', 'I am used to live in Delhi.'], answer: 'I used to live in Delhi.', explanation: 'Used to can describe a past state that is no longer true.' },
    cards: [{ front: 'Can "used to" describe a past state?', back: 'Yes: I used to live in a village.' }, { front: 'Can "would" describe a repeated past action?', back: 'Yes: Every evening, we would play outside.' }, { front: 'What follows "used to"?', back: 'The base form of the verb: used to play.' }],
  },
  {
    id: 'noun-modifiers', title: 'Noun Modifiers', short: 'Noun Modifiers', category: 'Grammar',
    description: 'Add detail to the things you name.',
    lesson: 'A noun modifier gives more information about another noun. It usually comes before the main noun and is often singular, as in "a school bus" or "a coffee cup".',
    examples: ['A stone wall surrounds the garden.', 'She carries a water bottle.'],
    mistake: 'The modifying noun is usually singular: "a shoe shop", not "a shoes shop".',
    practice: { question: 'Which phrase uses a noun modifier?', options: ['a garden gate', 'a gate opened', 'the garden grows', 'very green'], answer: 'a garden gate', explanation: 'Garden is a noun that describes the noun gate.' },
    cards: [{ front: 'What is a noun modifier?', back: 'A noun used to describe another noun, as in "chocolate cake".' }, { front: 'In "school bus", what is the main noun?', back: 'Bus. School tells us what kind of bus.' }, { front: 'Is the modifier usually singular or plural?', back: 'Usually singular: a book shop, a ten-minute walk.' }],
  },
  {
    id: 'advice', title: 'Giving Advice and Language Functions', short: 'Giving Advice', category: 'Grammar',
    description: 'Say the helpful thing, thoughtfully.',
    lesson: 'Use should, ought to, could or expressions such as "If I were you" to offer advice. Match your language to the situation and keep suggestions polite.',
    examples: ['You should drink more water.', 'If I were you, I would ask for help.'],
    mistake: 'Use the base verb after should: "You should rest", not "You should to rest".',
    practice: { question: 'Which sentence gives polite advice?', options: ['You should get some rest.', 'You should to get rest.', 'You getting rest.', 'You musted rest.'], answer: 'You should get some rest.', explanation: 'Should is followed by the base form of the verb.' },
    cards: [{ front: 'What verb form follows "should"?', back: 'The base form: You should practise.' }, { front: 'Complete: If I were you, I ___ ask.', back: 'Would: If I were you, I would ask.' }, { front: 'Give advice using "could".', back: 'You could speak to your teacher.' }],
  },
  {
    id: 'synonyms', title: 'Synonyms', short: 'Synonyms', category: 'Vocabulary',
    description: 'Discover another way to say it.',
    lesson: 'Synonyms are words with similar meanings. They are not always interchangeable: check the context, tone and part of speech before choosing one.',
    examples: ['Brave and courageous are synonyms.', 'A tiny seed is a very small seed.'],
    mistake: 'Similar words can have different shades of meaning: "slim" and "skinny" may have different tones.',
    practice: { question: 'Which word is closest in meaning to "brave"?', options: ['courageous', 'timid', 'silent', 'angry'], answer: 'courageous', explanation: 'Courageous and brave both describe someone who shows courage.' },
    cards: [{ front: 'A synonym for "rapid"?', back: 'Fast or quick.' }, { front: 'A synonym for "generous"?', back: 'Giving or charitable, depending on context.' }, { front: 'Why check the context of synonyms?', back: 'Words with similar meanings can differ in tone or usage.' }],
  },
  {
    id: 'antonyms', title: 'Antonyms', short: 'Antonyms', category: 'Vocabulary',
    description: 'Learn by looking at opposites.',
    lesson: 'Antonyms are words with opposite or contrasting meanings. Some are formed with prefixes, while others are completely different words.',
    examples: ['Ancient is the opposite of modern.', 'Possible and impossible are antonyms.'],
    mistake: 'Keep the same part of speech: the opposite of the adjective "happy" is "unhappy", not "sadness".',
    practice: { question: 'Which word is an antonym of "scarce"?', options: ['abundant', 'rare', 'limited', 'little'], answer: 'abundant', explanation: 'Scarce means in short supply; abundant means plentiful.' },
    cards: [{ front: 'An antonym for "ancient"?', back: 'Modern.' }, { front: 'An antonym for "expand"?', back: 'Contract or shrink.' }, { front: 'What should antonyms usually share?', back: 'The same part of speech and a contrasting meaning.' }],
  },
  {
    id: 'word-forms', title: 'Correct Word Forms and Word Formation', short: 'Word Formation', category: 'Vocabulary',
    description: 'Turn one word into many.',
    lesson: 'Word formation changes a base word to fit a sentence. Suffixes can create nouns, verbs, adjectives or adverbs: create, creation, creative and creatively.',
    examples: ['Her kindness made everyone smile.', 'He answered the question confidently.'],
    mistake: 'Choose the part of speech needed by the sentence: "a careful driver" but "drives carefully".',
    practice: { question: 'She answered the question ___.', options: ['confidently', 'confidence', 'confident', 'confide'], answer: 'confidently', explanation: 'An adverb describes how she answered.' },
    cards: [{ front: 'What is the noun form of "decide"?', back: 'Decision.' }, { front: 'What is the adjective form of "care"?', back: 'Careful or careless, depending on meaning.' }, { front: 'What does an adverb often modify?', back: 'A verb, adjective or another adverb.' }],
  },
  {
    id: 'prefixes-suffixes', title: 'Prefixes, Suffixes, and Incomplete Spellings', short: 'Prefixes & Suffixes', category: 'Vocabulary',
    description: 'Small word parts, big possibilities.',
    lesson: 'A prefix comes before a base word and a suffix comes after it. They can change meaning or word class; use familiar word parts and context to complete spellings.',
    examples: ['Un + kind = unkind.', 'Care + ful = careful.'],
    mistake: 'Not every negative prefix fits every word: "impossible" is correct, not "unpossible".',
    practice: { question: 'Which is the correct negative form of "possible"?', options: ['impossible', 'unpossible', 'dispossible', 'inpossible'], answer: 'impossible', explanation: 'The prefix im- is used in impossible.' },
    cards: [{ front: 'Where does a prefix go?', back: 'Before the base word: unhappy.' }, { front: 'Where does a suffix go?', back: 'After the base word: helpful.' }, { front: 'What does the prefix "re-" often mean?', back: 'Again: reread means read again.' }],
  },
  {
    id: 'spelling', title: 'Spelling Correction', short: 'Spelling Correction', category: 'Vocabulary',
    description: 'Build confidence, letter by letter.',
    lesson: 'Look for familiar roots, syllables and letter patterns. Read the word aloud, compare it with words you know, and use a dictionary to check uncertain spellings.',
    examples: ['Correct: necessary, not neccessary.', 'Correct: separate, not seperate.'],
    mistake: 'Do not rely on sound alone: some English letters are silent or have several pronunciations.',
    practice: { question: 'Which spelling is correct?', options: ['necessary', 'neccessary', 'necesary', 'nessesary'], answer: 'necessary', explanation: 'Necessary has one c and two s letters.' },
    cards: [{ front: 'Spell the word meaning "needed".', back: 'Necessary: one c and two s letters.' }, { front: 'Which is correct: separate or seperate?', back: 'Separate.' }, { front: 'How can you check an unfamiliar spelling?', back: 'Look it up in a reliable dictionary and note its word family.' }],
  },
  {
    id: 'dictionary', title: 'Dictionary Skills and Word Lookup', short: 'Dictionary Skills', category: 'Vocabulary',
    description: 'Find meaning with confidence.',
    lesson: 'A dictionary entry can show pronunciation, part of speech, definitions, examples and word forms. Choose the definition that matches the sentence.',
    examples: ['"Light" can mean not heavy or a source of illumination.', 'Guide words help you find an alphabetical range.'],
    mistake: 'Do not automatically choose the first definition; a word can have several meanings.',
    practice: { question: 'What helps you select the right dictionary definition?', options: ['The context of the sentence', 'Only the first letter', 'The longest definition', 'The page colour'], answer: 'The context of the sentence', explanation: 'Context tells you which sense of a word is intended.' },
    cards: [{ front: 'What do dictionary guide words show?', back: 'The first and last entry words on a page or in a range.' }, { front: 'Why can a word have several definitions?', back: 'A word can have different senses or act as different parts of speech.' }, { front: 'What does a pronunciation guide show?', back: 'How a word is spoken, often using phonetic symbols.' }],
  },
  {
    id: 'phrasal-verbs', title: 'Phrasal Verbs and Idioms', short: 'Phrasal Verbs & Idioms', category: 'Vocabulary',
    description: 'Go beyond the literal meaning.',
    lesson: 'A phrasal verb combines a verb with a particle, often creating a new meaning. An idiom is an expression whose meaning cannot always be guessed from its individual words.',
    examples: ['Look after means take care of.', '"A piece of cake" means something is easy.'],
    mistake: 'Do not translate every part of an idiom literally; learn its meaning in context.',
    practice: { question: 'What does "look after" mean?', options: ['take care of', 'search for', 'give up', 'look behind'], answer: 'take care of', explanation: 'To look after someone or something is to take care of them.' },
    cards: [{ front: 'What does "give up" mean?', back: 'To stop trying or stop doing something.' }, { front: 'What does "a piece of cake" mean?', back: 'Something very easy.' }, { front: 'What does "look after" mean?', back: 'To take care of someone or something.' }],
  },
  {
    id: 'word-meanings', title: 'Matching Words with Their Meanings', short: 'Words & Meanings', category: 'Vocabulary',
    description: 'Make meaning stick.',
    lesson: 'Match a word to its meaning by identifying its part of speech and looking for clues in context. Eliminate definitions that do not fit the sentence.',
    examples: ['Vivid means producing a clear, strong image.', 'Reluctant means unwilling or hesitant.'],
    mistake: 'Avoid choosing a definition just because it sounds familiar; test it in the original sentence.',
    practice: { question: 'Which meaning matches "reluctant"?', options: ['unwilling or hesitant', 'eager to begin', 'very colourful', 'easy to understand'], answer: 'unwilling or hesitant', explanation: 'Reluctant describes someone who is unwilling or hesitant.' },
    cards: [{ front: 'What does "vivid" mean?', back: 'Producing a clear, strong image or impression.' }, { front: 'What does "reluctant" mean?', back: 'Unwilling or hesitant.' }, { front: 'What does "fragile" mean?', back: 'Easily broken or damaged.' }],
  },
];

export const topicById = (id: string) => topics.find((topic) => topic.id === id);
export const allFlashcards = topics.flatMap((topic) => topic.cards.map((card, index) => ({ ...card, id: `${topic.id}-${index + 1}`, topicId: topic.id, category: topic.category })));