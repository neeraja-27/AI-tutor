const assert = require('assert');
const AdaptiveQuizEngine = require('./adaptiveQuizEngine');

async function runTests() {
  console.log('--- Starting Adaptive Quiz Engine Project Isolation Tests ---');

  // TEST 1: Python Project Isolation
  console.log('\nTest 1: Python Project Isolation...');
  const pythonLearningState = {
    projectContext: {
      projectId: 'proj_python_123',
      projectName: 'Python Basics & Advanced Concepts',
      projectGoal: 'Master Python programming, data structures, and OOP',
      domain: 'python',
      materialFileNames: ['Python_Guide.pdf'],
      textExcerpt: 'Python uses indentation for blocks. Lists, tuples, and dictionaries are primary data structures. Generators use yield for lazy evaluation.',
      tutorSnippets: 'User: How do list comprehensions work in Python?\nAI: List comprehensions offer a succinct syntax [x for x in data].',
    },
    masteryMap: {
      'Python Syntax, Variables & Dynamic Typing': { level: 40, status: 'requiring_attention', historyCount: 2 },
      'Data Structures: Lists, Tuples, Dictionaries & Sets': { level: 75, status: 'stable', historyCount: 4 },
      'List Comprehensions & Generator Expressions': { level: 30, status: 'requiring_attention', historyCount: 1 },
    },
    pastMistakes: [
      {
        concept: 'List Comprehensions & Generator Expressions',
        questionText: 'Difference between generator expression and list comprehension',
        feedback: 'Forgot that generators are evaluated lazily.',
      },
    ],
    recentChatTopics: 'list comprehensions and generators in python',
    availableConcepts: [
      'Python Syntax, Variables & Dynamic Typing',
      'Data Structures: Lists, Tuples, Dictionaries & Sets',
      'List Comprehensions & Generator Expressions',
      'Decorators & Closures',
      'Object-Oriented Python & Dunder Methods',
    ],
  };

  // Verify NO Java concepts leaked into Python project
  pythonLearningState.availableConcepts.forEach((c) => {
    assert.ok(!c.toLowerCase().includes('java'), `Concept "${c}" must not be Java in a Python project!`);
    assert.ok(!c.toLowerCase().includes('jvm'), `Concept "${c}" must not contain JVM in a Python project!`);
  });

  const pySelection = AdaptiveQuizEngine.selectConceptAndDifficulty(pythonLearningState, {
    questions: [],
    answers: [],
    mistakes: [],
    currentQuestionIndex: 0,
  });

  console.log('✓ Python Selection:', pySelection.concept, `[${pySelection.difficulty}]`, pySelection.type);
  assert.strictEqual(
    pySelection.concept,
    'List Comprehensions & Generator Expressions',
    'Engine must prioritize Python concept with lowest mastery and recent mistake'
  );
  assert.ok(pySelection.rationale.includes('PYTHON'), 'Rationale must reflect Python domain');

  // Generate question for Python
  const pyQuestion = await AdaptiveQuizEngine.generateAdaptiveQuestion(
    'proj_python_123',
    pySelection.concept,
    pySelection.difficulty,
    pySelection.type,
    pySelection.rationale,
    pythonLearningState
  );

  console.log('✓ Python Generated Question:', pyQuestion.question);
  assert.ok(
    pyQuestion.question.toLowerCase().includes('python') ||
    pyQuestion.question.toLowerCase().includes('generator') ||
    pyQuestion.question.toLowerCase().includes('yield') ||
    pyQuestion.question.toLowerCase().includes('list'),
    'Question must be about Python!'
  );
  assert.ok(!pyQuestion.question.toLowerCase().includes('jvm'), 'Question must NOT mention JVM!');
  assert.ok(!pyQuestion.question.toLowerCase().includes('bytecode'), 'Question must NOT mention Java bytecode!');

  // TEST 2: Java Project Isolation
  console.log('\nTest 2: Java Project Isolation...');
  const javaLearningState = {
    projectContext: {
      projectId: 'proj_java_456',
      projectName: 'Java OOP Fundamentals',
      projectGoal: 'Understand JVM, inheritance, and dynamic dispatch',
      domain: 'java',
      materialFileNames: ['Java_Basics_and_OOP_10_Pages.pdf'],
      textExcerpt: 'Java is compiled to bytecode and executed by the JVM.',
      tutorSnippets: 'User: What is dynamic dispatch in Java?\nAI: It resolves overridden methods at runtime.',
    },
    masteryMap: {
      'Java Platform & Execution': { level: 85, status: 'improving', historyCount: 5 },
      'Polymorphism & Dynamic Dispatch': { level: 25, status: 'requiring_attention', historyCount: 1 },
    },
    pastMistakes: [
      {
        concept: 'Polymorphism & Dynamic Dispatch',
        questionText: 'What is dynamic dispatch?',
        feedback: 'Confused static binding with dynamic dispatch.',
      },
    ],
    recentChatTopics: 'polymorphism and dynamic dispatch in java',
    availableConcepts: [
      'Java Platform & Execution',
      'Variables, Data Types & Operators',
      'Polymorphism & Dynamic Dispatch',
      'Encapsulation',
      'Inheritance & Overriding',
    ],
  };

  const javaSelection = AdaptiveQuizEngine.selectConceptAndDifficulty(javaLearningState, {
    questions: [],
    answers: [],
    mistakes: [],
    currentQuestionIndex: 0,
  });

  console.log('✓ Java Selection:', javaSelection.concept, `[${javaSelection.difficulty}]`, javaSelection.type);
  assert.strictEqual(
    javaSelection.concept,
    'Polymorphism & Dynamic Dispatch',
    'Engine must prioritize Java concept with lowest mastery and recent mistake'
  );

  const javaQuestion = await AdaptiveQuizEngine.generateAdaptiveQuestion(
    'proj_java_456',
    javaSelection.concept,
    javaSelection.difficulty,
    javaSelection.type,
    javaSelection.rationale,
    javaLearningState
  );

  console.log('✓ Java Generated Question:', javaQuestion.question);
  assert.ok(
    javaQuestion.question.toLowerCase().includes('java') ||
    javaQuestion.question.toLowerCase().includes('dispatch') ||
    javaQuestion.question.toLowerCase().includes('animal') ||
    javaQuestion.question.toLowerCase().includes('polymorphism'),
    'Question must be about Java!'
  );
  assert.ok(!javaQuestion.question.toLowerCase().includes('def '), 'Java question must NOT contain Python def!');

  // TEST 3: Cross-Project Distinction
  console.log('\nTest 3: Cross-Project Strict Isolation...');
  assert.notStrictEqual(
    pySelection.concept,
    javaSelection.concept,
    'Python and Java projects must select their own domain concepts'
  );
  assert.notStrictEqual(
    pyQuestion.question,
    javaQuestion.question,
    'Questions generated in Python project must be completely distinct from Java project'
  );

  // TEST 4: Open-Ended Answer Evaluation for Python
  console.log('\nTest 4: Open-Ended Answer Evaluation for Python...');
  const pyOpenEndedQuestion = {
    type: 'open_ended',
    concept: 'List Comprehensions & Generator Expressions',
    difficulty: 'medium',
    question: 'Explain why generators in Python are memory efficient compared to lists.',
    rubric: {
      keyConcepts: ['yield keyword', 'lazy evaluation', 'O(1) memory footprint', 'iterator protocol'],
      guidelines: 'Explain streaming on demand vs storing full sequence in memory.',
      sampleAnswer: 'Generators evaluate lazily using yield, producing items one at a time without allocating memory for the whole sequence upfront.'
    }
  };

  const studentPythonAnswer = 'Generators use lazy evaluation and the yield keyword to produce items on demand. This gives an O(1) memory footprint instead of allocating the entire list in memory.';
  const evalResult = await AdaptiveQuizEngine.evaluateAnswer(pyOpenEndedQuestion, studentPythonAnswer, 'proj_python_123', 'user1');

  console.log('✓ Evaluated Python Answer - Score:', evalResult.score, 'isCorrect:', evalResult.isCorrect);
  console.log('   Feedback:', evalResult.feedback);
  console.log('   Covered Concepts:', evalResult.detailedEvaluation.keyConceptsCovered);
  assert.strictEqual(evalResult.isCorrect, true);
  assert.ok(evalResult.score >= 70);
  assert.ok(evalResult.detailedEvaluation.keyConceptsCovered.length > 0);

  console.log('\n======================================================');
  console.log('ALL STRICT PROJECT ISOLATION TESTS PASSED 100%!');
  console.log('======================================================');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
