const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Project = require('../models/Project');
const Mastery = require('../models/Mastery');
const Recommendation = require('../models/Recommendation');
const Material = require('../models/Material');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const AITrace = require('../models/AITrace');
const { QuizAttempt } = require('../models/Quiz');

// Resolve Groq API key from environment or sister .env file
function getGroqApiKey() {
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here') {
    return process.env.GROQ_API_KEY;
  }
  const ragEnvPath = path.resolve(__dirname, '../../../rag-service/.env');
  if (fs.existsSync(ragEnvPath)) {
    const content = fs.readFileSync(ragEnvPath, 'utf8');
    const match = content.match(/GROQ_API_KEY\s*=\s*(.+)/);
    if (match && match[1].trim()) {
      return match[1].trim();
    }
  }
  return null;
}

// =========================================================================
// MULTI-DOMAIN CURRICULUM KNOWLEDGE BASES (Strictly Isolated by Subject)
// =========================================================================

const PYTHON_CURRICULUM = {
  'Python Syntax, Variables & Dynamic Typing': {
    description: 'Dynamic typing, type inference, mutability vs immutability, casting, and indentation rules.',
    questions: [
      {
        type: 'mcq',
        difficulty: 'easy',
        question: 'Which of the following data types in Python is immutable?',
        choices: ['list', 'dict', 'tuple', 'set'],
        correctAnswer: 2,
        explanation: 'In Python, tuples (along with strings, ints, and floats) are immutable, meaning their elements cannot be modified in place after creation.'
      },
      {
        type: 'open_ended',
        difficulty: 'medium',
        question: 'Explain the difference between mutable and immutable types in Python. What happens under the hood when you modify a list versus reassigning a string?',
        rubric: {
          keyConcepts: ['Mutable objects can change state in place', 'Immutable objects create a new object in memory', 'id() and memory address changes', 'Examples: list vs str'],
          guidelines: 'Learner should explain in-place mutation vs allocating a new object and rebinding the variable name.',
          sampleAnswer: 'Mutable objects (like lists and dicts) can be modified in place without changing their memory address (id). Immutable objects (like strings and tuples) cannot be altered; any operation that appears to modify them actually creates a brand-new object in memory and updates the variable reference.'
        },
        explanation: 'Mutable objects can be mutated in place on the heap, whereas modifying immutable objects forces Python to allocate a new object in memory.'
      }
    ]
  },
  'Data Structures: Lists, Tuples, Dictionaries & Sets': {
    description: 'Indexing, slicing, dictionary key hashing, set operations, and time complexities.',
    questions: [
      {
        type: 'mcq',
        difficulty: 'medium',
        question: 'What is the average time complexity for checking membership (`key in my_dict`) in a Python dictionary?',
        choices: ['O(1)', 'O(n)', 'O(log n)', 'O(n log n)'],
        correctAnswer: 0,
        explanation: 'Python dictionaries are implemented using hash tables with open addressing, yielding an average lookup and membership check time complexity of O(1).'
      },
      {
        type: 'open_ended',
        difficulty: 'medium',
        question: 'Why must dictionary keys in Python be hashable? What data types can be used as keys, and why cannot a standard list be a dictionary key?',
        rubric: {
          keyConcepts: ['Keys must implement __hash__ and __eq__', 'Must be immutable / hashable', 'Lists are mutable so their hash would change', 'Tuples containing immutables are valid keys'],
          guidelines: 'Explain hash consistency across object lifetime and why mutating a key would break hash bucket lookups.',
          sampleAnswer: 'Dictionary keys must be hashable so Python can calculate a stable hash value to map the key to an internal bucket. Because lists are mutable, their contents and hash could change after insertion, making them impossible to find. Therefore, only immutable types (like strings, ints, or tuples of immutables) can be keys.'
        },
        explanation: 'Dictionary keys must have an immutable hash value throughout their lifetime to guarantee correct hash table bucket indexing.'
      }
    ]
  },
  'Functions, Scope & Arguments (*args, **kwargs)': {
    description: 'Parameter packing, unpacking, keyword arguments, LEGB scope rule, and closures.',
    questions: [
      {
        type: 'mcq',
        difficulty: 'medium',
        question: 'In Python, what does the `*args` syntax in a function definition do?',
        choices: [
          'Forces all arguments to be keyword-only',
          'Packs extra positional arguments into a tuple',
          'Packs extra keyword arguments into a dictionary',
          'Passes arguments by pointer reference'
        ],
        correctAnswer: 1,
        explanation: 'The `*args` parameter collects arbitrary extra positional arguments into a single tuple inside the function.'
      },
      {
        type: 'open_ended',
        difficulty: 'hard',
        question: 'Explain Python\'s LEGB scoping rule (Local, Enclosing, Global, Built-in). How do the `global` and `nonlocal` keywords modify default scoping behavior in nested functions?',
        rubric: {
          keyConcepts: ['Local scope within function', 'Enclosing scope in nested functions', 'Global module-level scope', 'Built-in namespace', 'nonlocal modifies enclosing scope', 'global modifies module scope'],
          guidelines: 'Must describe the search order when resolving identifiers and clarify how nonlocal enables closures to mutate enclosing state.',
          sampleAnswer: 'Python resolves names by checking Local scope first, then Enclosing (outer functions), Global (module level), and finally Built-in. By default, assigning to a variable inside a function creates a local variable. The `global` keyword binds the variable to the module level, while `nonlocal` allows a nested function to modify a variable in the enclosing outer function scope.'
        },
        explanation: 'LEGB defines the name resolution order, and global/nonlocal permit rebinding variables outside the local namespace.'
      }
    ]
  },
  'Object-Oriented Python & Dunder Methods': {
    description: 'Classes, __init__, self, inheritance, super(), and special dunder methods (__str__, __repr__, __len__).',
    questions: [
      {
        type: 'mcq',
        difficulty: 'medium',
        question: 'In Python classes, what is the primary distinction between `__str__` and `__repr__`?',
        choices: [
          '`__str__` is for developers/debugging; `__repr__` is for end users',
          '`__str__` is intended for readable user display; `__repr__` is an unambiguous representation for developers',
          '`__str__` returns a byte string, while `__repr__` returns unicode',
          'There is no functional difference; they are aliases'
        ],
        correctAnswer: 1,
        explanation: '`__str__` provides a human-readable string for end users (used by `print()`), whereas `__repr__` aims to be unambiguous and machine-readable for developers and debugging.'
      },
      {
        type: 'open_ended',
        difficulty: 'hard',
        question: 'Describe how inheritance works in Python. What is the Method Resolution Order (MRO), and how does `super()` resolve calls in multiple inheritance scenarios (C3 linearization)?',
        rubric: {
          keyConcepts: ['Multiple inheritance support', 'C3 Linearization algorithm', 'MRO (__mro__ attribute)', 'super() follows MRO rather than parent class directly', 'Cooperative multiple inheritance'],
          guidelines: 'Learner should explain that super() delegates to the next class in the MRO, not simply the immediate parent, preventing duplicate calls.',
          sampleAnswer: 'Python supports multiple inheritance using the C3 Linearization algorithm to determine the Method Resolution Order (MRO). The MRO guarantees monotonicity and preserves local precedence. `super()` does not just call the immediate parent; it calls the next class in the object\'s MRO chain, enabling cooperative diamond inheritance.'
        },
        explanation: 'Python uses C3 linearization to produce a deterministic MRO, and super() navigates this order cooperatively.'
      }
    ]
  },
  'List Comprehensions & Generator Expressions': {
    description: 'Concise collection transforms, filtering, generator functions with yield, and lazy evaluation.',
    questions: [
      {
        type: 'mcq',
        difficulty: 'medium',
        question: 'What is the main benefit of using a generator expression `(x*2 for x in data)` instead of a list comprehension `[x*2 for x in data]`?',
        choices: [
          'Generators support random indexing `gen[0]`',
          'Generators evaluate lazily, consuming minimal memory for large sequences',
          'Generators are compiled directly into C code',
          'Generators can only iterate over integer types'
        ],
        correctAnswer: 1,
        explanation: 'Generators yield items one at a time upon request (lazy evaluation) without constructing the entire sequence in memory upfront.'
      },
      {
        type: 'open_ended',
        difficulty: 'hard',
        question: 'Explain how the `yield` keyword transforms a Python function into a generator. Contrast the memory footprint and execution mechanics of an eager list return versus a lazy generator.',
        rubric: {
          keyConcepts: ['yield pauses execution and preserves frame state', 'Returns a generator iterator', 'Lazy evaluation produces values on-demand with next()', 'Constant O(1) memory footprint vs O(N) list allocation'],
          guidelines: 'Should explain frame suspension/resumption and how generators avoid loading huge datasets into RAM.',
          sampleAnswer: 'When a function contains `yield`, calling it returns a generator object instead of running to completion. When `next()` is called on it, execution runs until the `yield` statement, returns the value, and suspends its local state. Unlike an eager list that allocates all items in memory (O(N)), a generator streams items lazily (O(1) auxiliary memory).'
        },
        explanation: 'Generators suspend and resume stack frames with yield, allowing memory-efficient on-demand streaming of sequences.'
      }
    ]
  },
  'Decorators & Closures': {
    description: 'First-class functions, wrapping behavior, functools.wraps, and parameterized decorators.',
    questions: [
      {
        type: 'mcq',
        difficulty: 'hard',
        question: 'Why is `@functools.wraps(fn)` commonly used inside custom Python decorators?',
        choices: [
          'To make the decorated function asynchronous',
          'To preserve the original function\'s name, docstring, and metadata',
          'To ensure the function executes in a background thread',
          'To memoize the function\'s return values'
        ],
        correctAnswer: 1,
        explanation: '`functools.wraps` copies original attributes like `__name__` and `__doc__` from the wrapped function to the wrapper, preventing metadata masking.'
      },
      {
        type: 'open_ended',
        difficulty: 'hard',
        question: 'How do Python decorators leverage first-class functions and closures? Write a conceptual explanation of how `@my_decorator` syntax translates into higher-order function calls.',
        rubric: {
          keyConcepts: ['Functions are first-class objects (passed as arguments/returned)', 'Closures capture and retain enclosing variables', 'Syntax sugar: @dec def f() is equivalent to f = dec(f)', 'Wrapper function delegates to original function'],
          guidelines: 'Must explain the syntactic transformation and how the wrapper retains access to the wrapped function reference.',
          sampleAnswer: 'In Python, functions are first-class objects. A decorator is a higher-order function that takes a function as an argument and returns an enhanced wrapper function. The `@my_decorator` syntax is syntactic sugar for `func = my_decorator(func)`. The returned wrapper forms a closure over the original function, executing pre/post logic around the invocation.'
        },
        explanation: 'Decorators are closures that wrap callable objects, enabled by Python\'s first-class function model.'
      }
    ]
  },
  'Error & Exception Handling (try/except/finally)': {
    description: 'Exception hierarchy, custom exceptions, finally block cleanup, and context managers (with).',
    questions: [
      {
        type: 'mcq',
        difficulty: 'easy',
        question: 'In Python exception handling, when is the `finally` block guaranteed to execute?',
        choices: [
          'Only when an exception is raised',
          'Only when no exception is raised',
          'Always, regardless of whether an exception occurred or was caught',
          'Only if the `except` block catches a BaseException'
        ],
        correctAnswer: 2,
        explanation: 'The `finally` block always executes under normal circumstances, even if an unhandled exception or return statement occurs in the try/except blocks.'
      },
      {
        type: 'open_ended',
        difficulty: 'medium',
        question: 'What is the purpose of Python Context Managers (the `with` statement)? Explain how the `__enter__` and `__exit__` dunder methods guarantee resource safety.',
        rubric: {
          keyConcepts: ['with statement manages setup and teardown', '__enter__ initializes resource', '__exit__ handles cleanup even on error', 'Common use: file I/O, database connections, locks'],
          guidelines: 'Explain guaranteed cleanup (e.g. closing files or releasing locks) without manual try...finally boilerplate.',
          sampleAnswer: 'Context managers ensure that resources are properly acquired and released using the `with` statement. The `__enter__` method sets up the resource (e.g. opening a file) and returns it. The `__exit__` method is guaranteed to run upon exiting the block—even if an unhandled exception is raised—ensuring automatic resource cleanup without manual finally blocks.'
        },
        explanation: 'Context managers encapsulate try...finally resource cleanup via the __enter__ and __exit__ protocol.'
      }
    ]
  }
};

const JAVA_CURRICULUM = {
  'Java Platform & Execution': {
    description: 'JVM, Bytecode, JDK vs JRE, and write-once-run-anywhere paradigm.',
    questions: [
      {
        type: 'mcq',
        difficulty: 'easy',
        question: 'Which component is responsible for executing Java bytecode on a specific hardware platform?',
        choices: [
          'Java Development Kit (JDK)',
          'Java Virtual Machine (JVM)',
          'Java Source Compiler (javac)',
          'Java Standard Library (JSL)'
        ],
        correctAnswer: 1,
        explanation: 'The JVM (Java Virtual Machine) is the runtime engine that interprets or JIT-compiles platform-independent bytecode into machine code for the host OS.'
      },
      {
        type: 'open_ended',
        difficulty: 'medium',
        question: 'Explain the distinction between the JDK, JRE, and JVM, and describe how bytecode achieves platform independence in Java.',
        rubric: {
          keyConcepts: ['JDK includes compiler & dev tools', 'JRE contains runtime libraries', 'JVM executes bytecode', 'Bytecode is OS-neutral'],
          guidelines: 'Learner should clarify what each tier contains and explain that javac produces bytecode (.class) which any platform-specific JVM can run.',
          sampleAnswer: 'The JDK (Java Development Kit) contains tools to develop Java apps including javac. The JRE contains runtime libraries and the JVM. Bytecode is an intermediate representation executed by platform-specific JVMs, enabling "Write Once, Run Anywhere".'
        },
        explanation: 'Platform independence is achieved because javac compiles source code to intermediate bytecode, and platform-specific JVMs interpret or compile it to host machine code.'
      }
    ]
  },
  'Variables, Data Types & Operators': {
    description: 'Primitive types, references, type casting, and operator precedence.',
    questions: [
      {
        type: 'mcq',
        difficulty: 'easy',
        question: 'Which of the following is a reference type rather than a primitive type in Java?',
        choices: ['int', 'boolean', 'String', 'char'],
        correctAnswer: 2,
        explanation: 'String is a class and reference type in Java, whereas int, boolean, and char are primitive types stored directly on the stack.'
      },
      {
        type: 'open_ended',
        difficulty: 'medium',
        question: 'What is the difference between widening (implicit) and narrowing (explicit) type casting in Java? Give a practical example of when precision loss can occur.',
        rubric: {
          keyConcepts: ['Widening is automatic from smaller to larger type', 'Narrowing requires explicit cast', 'Data truncation / overflow / precision loss'],
          guidelines: 'Must explain safe automatic conversion vs manual casting that risks fractional truncation or integer overflow.',
          sampleAnswer: 'Widening casting converts a smaller primitive type to a larger one automatically (e.g. int to double) without data loss. Narrowing casting converts a larger type to a smaller one (e.g. double to int) requiring explicit syntax (int)val, which truncates decimals.'
        },
        explanation: 'Narrowing type casting truncates fractional parts or overflows range, requiring explicit developer intent.'
      }
    ]
  },
  'Control Flow & Methods': {
    description: 'Conditionals, loops, method signatures, return types, and parameter passing.',
    questions: [
      {
        type: 'mcq',
        difficulty: 'medium',
        question: 'How does Java handle parameter passing for primitive values versus object references?',
        choices: [
          'Primitives are passed by value; objects are passed by reference',
          'All parameters in Java are passed strictly by value',
          'Primitives are passed by reference; objects are passed by value',
          'It depends on whether the method is declared static or non-static'
        ],
        correctAnswer: 1,
        explanation: 'Java is strictly pass-by-value. When passing an object, the value of the reference (pointer/memory address) is passed by value.'
      },
      {
        type: 'open_ended',
        difficulty: 'hard',
        question: 'Demonstrate why Java is strictly "pass-by-value" when passing object references to a method. What happens if you reassign the parameter reference inside the method versus modifying the object fields?',
        rubric: {
          keyConcepts: ['Pass-by-value of reference address', 'Modifying fields mutates underlying object', 'Reassigning parameter reference does not affect caller'],
          guidelines: 'Must distinguish between mutating the referenced object state and attempting to rebind the caller’s reference variable.',
          sampleAnswer: 'Java passes the reference pointer by value. Inside the method, calling setters modifies the original heap object. However, reassigning the parameter reference to a new object (e.g. param = new Object()) only updates the local parameter copy and does not alter the caller reference.'
        },
        explanation: 'Reassigning a method parameter variable only changes the local copy of the reference, not the original reference in the calling scope.'
      }
    ]
  },
  'Classes & Objects': {
    description: 'Blueprints, heap allocation, constructors, this keyword, and garbage collection.',
    questions: [
      {
        type: 'mcq',
        difficulty: 'easy',
        question: 'What happens when you do not define any constructor in a Java class?',
        choices: [
          'The class cannot be instantiated',
          'A compilation error occurs',
          'The Java compiler inserts a default no-argument constructor',
          'The class is automatically converted to an abstract class'
        ],
        correctAnswer: 2,
        explanation: 'If no constructors are explicitly declared, the compiler provides a public default no-arg constructor that invokes super().'
      },
      {
        type: 'open_ended',
        difficulty: 'medium',
        question: 'Explain the purpose and lifecycle of constructors in Java. How does the "this" keyword assist in resolving constructor shadowing?',
        rubric: {
          keyConcepts: ['Initializes object state in heap', 'Invoked upon new keyword', 'this differentiates instance fields from parameter variables'],
          guidelines: 'Should explain initialization timing and how this.fieldName distinguishes object fields from shadowing parameters.',
          sampleAnswer: 'Constructors initialize newly created instances on the heap when the new operator is invoked. When constructor parameters share names with instance fields, this.fieldName disambiguates the instance attribute from the local parameter.'
        },
        explanation: 'Constructors set up instance state upon instantiation, and the this keyword references the current executing instance.'
      }
    ]
  },
  'Encapsulation': {
    description: 'Data hiding, access modifiers (private, protected, public, package-private), and getters/setters.',
    questions: [
      {
        type: 'mcq',
        difficulty: 'medium',
        question: 'Why is making instance fields private and providing getters/setters considered good encapsulation?',
        choices: [
          'It makes the code run faster because private variables are cached in CPU registers',
          'It hides internal representation and enables validation/invariants before mutating state',
          'It allows other classes to override the fields directly',
          'It prevents the class from being garbage collected'
        ],
        correctAnswer: 1,
        explanation: 'Encapsulation safeguards internal state from unauthorized external mutation and allows validation logic inside setter methods.'
      },
      {
        type: 'open_ended',
        difficulty: 'medium',
        question: 'Explain the concept of Encapsulation in OOP. How do access modifiers and defensive copying protect internal state from unintended side-effects?',
        rubric: {
          keyConcepts: ['Data hiding with private fields', 'Controlled access via accessors/mutators', 'Validation of invariants', 'Defensive copies for mutable reference fields'],
          guidelines: 'Learner should articulate data protection, controlled interfaces, and how returning mutable objects can violate encapsulation unless copied.',
          sampleAnswer: 'Encapsulation bundles data and methods while restricting direct access to internal state using private modifiers. Controlled getters/setters enforce business rules and invariants. Defensive copying prevents external code from mutating internal reference types.'
        },
        explanation: 'Encapsulation protects object integrity by restricting direct field access and validating state transitions through controlled methods.'
      }
    ]
  },
  'Inheritance & Overriding': {
    description: 'Code reuse, class hierarchies, extends keyword, method overriding, super keyword, and single inheritance.',
    questions: [
      {
        type: 'mcq',
        difficulty: 'medium',
        question: 'Which rule must be followed when overriding a method in a subclass in Java?',
        choices: [
          'The subclass method must have a more restrictive access modifier',
          'The subclass method cannot throw fewer exceptions than the superclass method',
          'The subclass method must have the same name, return type (or covariant), and parameter list',
          'The subclass method must be declared static'
        ],
        correctAnswer: 2,
        explanation: 'Overriding requires matching method signature (name and parameter types) and compatible/covariant return type with equal or broader visibility.'
      },
      {
        type: 'open_ended',
        difficulty: 'hard',
        question: 'Compare Method Overriding with Method Overloading in Java. Describe the differences in binding time (compile-time vs runtime), method signature requirements, and the role of the @Override annotation.',
        rubric: {
          keyConcepts: ['Overloading is static/compile-time polymorphism with same name but different parameter list', 'Overriding is dynamic/runtime polymorphism with exact same signature in subclass', 'Role of @Override compiler check'],
          guidelines: 'Must distinguish static vs dynamic dispatch, parameter list rules, and how @Override prevents silent signature mismatch bugs.',
          sampleAnswer: 'Method overloading occurs within the same class when methods share a name but differ in parameters (resolved at compile-time). Method overriding occurs when a subclass provides a specific implementation for an inherited method with identical signature (resolved at runtime via dynamic dispatch). @Override instructs the compiler to verify the signature matches a superclass method.'
        },
        explanation: 'Overloading is resolved at compile time based on parameter types; overriding is resolved at runtime based on the actual instance type.'
      }
    ]
  },
  'Polymorphism & Dynamic Dispatch': {
    description: 'Subtype polymorphism, virtual method invocation, dynamic method lookup, and interface polymorphism.',
    questions: [
      {
        type: 'mcq',
        difficulty: 'hard',
        question: 'Consider: Animal a = new Dog(); a.makeSound(); where Dog overrides makeSound(). Which mechanism determines that Dog\'s implementation is executed?',
        choices: [
          'Static binding based on the declared type Animal',
          'Dynamic method dispatch based on the actual runtime object type Dog',
          'Constructor chaining',
          'Type casting at compile time'
        ],
        correctAnswer: 1,
        explanation: 'Java uses dynamic method dispatch at runtime: the JVM inspects the method table (vtable) of the actual heap object (Dog) and calls its overridden method.'
      },
      {
        type: 'open_ended',
        difficulty: 'hard',
        question: 'Explain what Dynamic Method Dispatch is in Java and how the JVM decides which method implementation to invoke when a superclass reference points to a subclass instance.',
        rubric: {
          keyConcepts: ['Superclass reference pointing to subclass instance', 'Runtime method lookup / vtable', 'Actual object type on heap vs declared reference type', 'Late binding / dynamic dispatch'],
          guidelines: 'Should mention reference type vs runtime type and explain how the JVM invokes the subclass version at runtime.',
          sampleAnswer: 'Dynamic method dispatch is runtime polymorphism where a call to an overridden method is resolved at runtime rather than compile time. When a superclass reference points to a subclass object, the JVM looks up the method in the object\'s actual runtime class method table (vtable) and executes the subclass implementation.'
        },
        explanation: 'Dynamic method dispatch resolves overridden method calls based on the runtime instance type rather than the compile-time reference type.'
      }
    ]
  },
  'Abstraction & Interfaces': {
    description: 'Abstract classes, pure contracts, default methods, multiple interface implementation, and decoupling.',
    questions: [
      {
        type: 'mcq',
        difficulty: 'medium',
        question: 'What is a primary difference between an abstract class and an interface in modern Java (Java 8+)?',
        choices: [
          'Interfaces can have stateful instance fields; abstract classes cannot',
          'A class can implement multiple interfaces but can extend only one abstract class',
          'Abstract classes cannot have concrete methods, while interfaces can',
          'Interfaces cannot contain any method implementations whatsoever'
        ],
        correctAnswer: 1,
        explanation: 'Java supports multiple inheritance of type through interfaces, but classes can only extend a single class (single inheritance).'
      },
      {
        type: 'open_ended',
        difficulty: 'hard',
        question: 'When designing a software system in Java, how do you decide whether to use an abstract class versus an interface? Provide design criteria and trade-offs for each.',
        rubric: {
          keyConcepts: ['is-a hierarchy vs can-do capability', 'State sharing / non-static fields in abstract class', 'Multiple interface implementation', 'Loose coupling / pluggability'],
          guidelines: 'Must highlight state sharing/code reuse for abstract class vs capability contract and multiple implementation flexibility for interfaces.',
          sampleAnswer: 'Use an abstract class when classes share a strong "is-a" identity, need to share common non-static state (instance fields), or require shared protected helper methods. Use an interface when defining a capability or behavioral contract ("can-do") across unrelated classes, or when multiple inheritance of behavior is needed.'
        },
        explanation: 'Abstract classes provide base implementations and state for closely related classes, while interfaces define decoupled behavioral contracts.'
      }
    ]
  }
};

const JAVASCRIPT_CURRICULUM = {
  'JavaScript Types, Scopes & Hoisting': {
    description: 'Primitives vs references, var vs let/const, temporal dead zone, and execution context.',
    questions: [
      {
        type: 'mcq',
        difficulty: 'medium',
        question: 'What causes a `ReferenceError` when accessing a `let` or `const` variable before its declaration line?',
        choices: [
          'The variable is not hoisted at all',
          'The variable is in the Temporal Dead Zone (TDZ)',
          'JavaScript does not support block scoping',
          'Variables declared with let are read-only'
        ],
        correctAnswer: 1,
        explanation: 'Variables declared with let and const are hoisted but remain uninitialized in the Temporal Dead Zone (TDZ) until their declaration line is evaluated.'
      },
      {
        type: 'open_ended',
        difficulty: 'medium',
        question: 'Explain the concept of Closures in JavaScript. Provide a practical use case such as data privacy or function factories.',
        rubric: {
          keyConcepts: ['Function bundled with lexical environment', 'Inner function retains access to outer variables', 'Data privacy / private state', 'Factory functions'],
          guidelines: 'Must explain lexical scoping retention after outer function returns.',
          sampleAnswer: 'A closure is created when an inner function retains access to its lexical outer environment even after the outer function has finished executing. This is frequently used for data privacy (emulating private variables) and creating function factories.'
        },
        explanation: 'Closures preserve access to outer lexical scope variables across execution contexts.'
      }
    ]
  },
  'Asynchronous JavaScript & Event Loop': {
    description: 'Call stack, task queue, microtask queue, Promises, and async/await.',
    questions: [
      {
        type: 'mcq',
        difficulty: 'hard',
        question: 'In the JavaScript event loop, which queue has priority when the call stack becomes empty?',
        choices: [
          'The Macrotask Queue (setTimeout, setInterval)',
          'The Microtask Queue (Promise callbacks, queueMicrotask)',
          'The RequestAnimationFrame queue',
          'Both queues are interleaved in round-robin fashion'
        ],
        correctAnswer: 1,
        explanation: 'Microtasks (like Promise .then() callbacks) are processed with strict priority until the microtask queue is completely drained before any macrotask is dequeued.'
      },
      {
        type: 'open_ended',
        difficulty: 'hard',
        question: 'Walk through how the JavaScript Event Loop coordinates asynchronous execution between the Call Stack, Web APIs, Microtask Queue, and Macrotask Queue.',
        rubric: {
          keyConcepts: ['Call Stack execution', 'Web APIs offload asynchronous tasks', 'Microtasks (Promises) executed immediately after current tick', 'Macrotasks (timers, events) executed in subsequent ticks'],
          guidelines: 'Explain the priority order and step-by-step coordination when an async operation completes.',
          sampleAnswer: 'Synchronous code executes on the single-threaded Call Stack. Asynchronous tasks (like fetch or setTimeout) are delegated to Web APIs. Upon completion, Promise callbacks enter the Microtask Queue, while timer/DOM callbacks enter the Macrotask Queue. Whenever the Call Stack empties, the Event Loop drains all Microtasks before pulling the next Macrotask.'
        },
        explanation: 'The event loop guarantees non-blocking I/O by executing microtasks immediately after stack clearance before handling macrotasks.'
      }
    ]
  }
};

// =========================================================================
// DOMAIN DETECTION & DYNAMIC EXTRACTION HELPERS
// =========================================================================

function detectProjectDomain({ projectName = '', learningGoal = '', description = '', materialNames = [], textSample = '', tutorMessages = '' }) {
  const combined = `${projectName} ${learningGoal} ${description} ${materialNames.join(' ')} ${textSample} ${tutorMessages}`.toLowerCase();

  let pyScore = 0;
  let javaScore = 0;
  let jsScore = 0;

  // Python Signals
  if (projectName.toLowerCase().includes('python')) pyScore += 100;
  if (materialNames.some((m) => m.toLowerCase().includes('python') || m.toLowerCase().includes('.py'))) pyScore += 80;
  if (combined.includes('python')) pyScore += 30;
  if (combined.includes('def ')) pyScore += 20;
  if (combined.includes('__init__')) pyScore += 20;
  if (combined.includes('list comprehension')) pyScore += 25;
  if (combined.includes('tuple') && !combined.includes('java')) pyScore += 15;
  if (combined.includes('elif ')) pyScore += 15;
  if (combined.includes('pandas') || combined.includes('numpy') || combined.includes('pip')) pyScore += 20;

  // Java Signals
  if (projectName.toLowerCase().includes('java') && !projectName.toLowerCase().includes('javascript')) javaScore += 100;
  if (materialNames.some((m) => m.toLowerCase().includes('java') && !m.toLowerCase().includes('javascript'))) javaScore += 80;
  if (combined.includes('jvm') || combined.includes('bytecode') || combined.includes('jdk') || combined.includes('jre')) javaScore += 50;
  if (combined.includes('public class')) javaScore += 25;
  if (combined.includes('system.out.println')) javaScore += 25;
  if (combined.includes('polymorphism') && combined.includes('overriding')) javaScore += 15;

  // JavaScript Signals
  if (projectName.toLowerCase().includes('javascript') || projectName.toLowerCase().includes('js') || projectName.toLowerCase().includes('react') || projectName.toLowerCase().includes('node')) jsScore += 100;
  if (materialNames.some((m) => m.toLowerCase().includes('javascript') || m.toLowerCase().includes('react') || m.toLowerCase().includes('.js'))) jsScore += 80;
  if (combined.includes('event loop') || combined.includes('async/await') || combined.includes('promises')) jsScore += 30;
  if (combined.includes('const ') || combined.includes('let ')) jsScore += 15;

  console.log(`[Domain Detection] Project: "${projectName}" -> Scores: Python=${pyScore}, Java=${javaScore}, JS=${jsScore}`);

  if (pyScore > javaScore && pyScore > jsScore) return 'python';
  if (javaScore > pyScore && javaScore > jsScore) return 'java';
  if (jsScore > pyScore && jsScore > javaScore) return 'javascript';

  // Check fallback from material names or project name directly
  if (projectName.toLowerCase().includes('python')) return 'python';
  if (projectName.toLowerCase().includes('java')) return 'java';
  if (projectName.toLowerCase().includes('js')) return 'javascript';

  return 'python'; // default sensible modern language if ambiguous
}

// Extract concept headings directly from the text of uploaded project PDFs
function extractConceptsFromMaterialText(rawText, domain) {
  if (!rawText || rawText.trim().length < 50) return [];
  const extracted = [];
  const lines = rawText.split('\n');

  lines.forEach((line) => {
    const trimmed = line.trim();
    // Match roadmap items like: "• Page 2 — Java platform, JVM" or "1. Variables & Types" or "Chapter 3: Functions"
    const roadmapMatch = trimmed.match(/^[•\-*]?\s*(?:Page\s*\d+\s*[—\-]|Chapter\s*\d+[:—\-]|Section\s*\d+[:—\-]|(?:\d+\.))\s*([A-Za-z0-9\s&,/()-]{4,50})/i);
    if (roadmapMatch && roadmapMatch[1]) {
      const conceptCandidate = roadmapMatch[1].trim();
      if (conceptCandidate.length >= 4 && !extracted.includes(conceptCandidate)) {
        extracted.push(conceptCandidate);
      }
    }
  });

  return extracted.slice(0, 10);
}

// =========================================================================
// MAIN ADAPTIVE QUIZ ENGINE
// =========================================================================

const AdaptiveQuizEngine = {
  // 1. Gather learning state strictly scoped to this specific project
  async understandCurrentLearningState(projectId, userId) {
    try {
      // 1.1 Fetch specific Project metadata
      const project = await Project.findById(projectId);
      const projectName = project?.name || 'Learning Project';
      const projectGoal = project?.learningGoal || project?.description || '';

      // 1.2 Fetch materials strictly belonging to THIS project
      const materials = await Material.find({ projectId });
      const materialFileNames = [];
      let projectExtractedText = '';

      for (const mat of materials) {
        materialFileNames.push(mat.originalName);
        if (mat.filePath && fs.existsSync(mat.filePath)) {
          try {
            // Extract text from the uploaded PDF
            const text = execSync(`pdftotext -l 15 "${mat.filePath}" -`, {
              encoding: 'utf8',
              timeout: 4000,
              maxBuffer: 4 * 1024 * 1024,
            });
            if (text && text.trim().length > 30) {
              projectExtractedText += `\n--- Document: ${mat.originalName} ---\n` + text;
            }
          } catch (e) {
            console.warn(`[pdftotext] Could not parse ${mat.originalName}:`, e.message);
          }
        }
      }

      // 1.3 Fetch AI Tutor conversations strictly belonging to THIS project
      const projectConversations = await Conversation.find({ projectId, userId }).sort({ startedAt: -1 }).limit(5);
      const convIds = projectConversations.map((c) => c._id);
      const projectMessages = await Message.find({ conversationId: { $in: convIds } })
        .sort({ timestamp: -1 })
        .limit(20);
      const tutorChatSummary = projectMessages.map((m) => `${m.sender}: ${m.text}`).join('\n');
      const recentChatTopics = projectMessages.filter((m) => m.sender === 'user').map((m) => m.text).join(' ');

      // 1.4 Detect Subject / Domain for THIS specific project
      const domain = detectProjectDomain({
        projectName,
        learningGoal: projectGoal,
        description: project?.description || '',
        materialNames: materialFileNames,
        textSample: projectExtractedText.slice(0, 10000),
        tutorMessages: tutorChatSummary,
      });

      console.log(`[AdaptiveQuizEngine] Project "${projectName}" (${projectId}) detected as domain: [${domain}]`);

      // 1.5 Select appropriate domain curriculum
      let baseCurriculum = PYTHON_CURRICULUM;
      if (domain === 'java') {
        baseCurriculum = JAVA_CURRICULUM;
      } else if (domain === 'javascript') {
        baseCurriculum = JAVASCRIPT_CURRICULUM;
      }

      // 1.6 Extract concepts from this project's uploaded materials
      const docConcepts = extractConceptsFromMaterialText(projectExtractedText, domain);

      // Candidate concepts strictly filtered by this project's domain
      let candidateConcepts = [...docConcepts];
      Object.keys(baseCurriculum).forEach((c) => {
        if (!candidateConcepts.includes(c)) {
          candidateConcepts.push(c);
        }
      });

      // 1.7 Fetch concept mastery records strictly belonging to THIS project
      const masteryRecords = await Mastery.find({ projectId, userId }).sort({ level: 1 });
      const masteryMap = {};
      masteryRecords.forEach((m) => {
        // Only include mastery records that match the current project's candidate concepts
        masteryMap[m.concept] = {
          level: m.level,
          status: m.status,
          historyCount: m.history?.length || 0,
          lastTested: m.updatedAt,
        };
        if (!candidateConcepts.includes(m.concept)) {
          candidateConcepts.push(m.concept);
        }
      });

      // 1.8 Fetch past quiz attempts strictly belonging to THIS project
      const pastAttempts = await QuizAttempt.find({ projectId, userId }).sort({ takenAt: -1 }).limit(10);
      const pastMistakes = [];
      const questionHistory = new Set();
      let totalPastQuestions = 0;
      let totalPastCorrect = 0;

      pastAttempts.forEach((att) => {
        if (att.answers && Array.isArray(att.answers)) {
          att.answers.forEach((ans) => {
            totalPastQuestions++;
            if (ans.isCorrect) {
              totalPastCorrect++;
            } else {
              pastMistakes.push({
                concept: ans.concept || 'General',
                questionText: ans.questionText || '',
                userAnswer: ans.userAnswer,
                feedback: ans.evaluationFeedback || '',
                date: att.takenAt,
              });
            }
            if (ans.questionText) {
              questionHistory.add(ans.questionText.trim().toLowerCase());
            }
          });
        }
      });

      const overallPastAccuracy = totalPastQuestions > 0 ? Math.round((totalPastCorrect / totalPastQuestions) * 100) : 50;

      const projectContext = {
        projectId: projectId.toString(),
        projectName,
        projectGoal,
        domain,
        materialFileNames,
        textExcerpt: projectExtractedText.slice(0, 4000),
        tutorSnippets: tutorChatSummary.slice(0, 2000),
      };

      return {
        projectContext,
        masteryRecords,
        masteryMap,
        pastMistakes,
        questionHistory,
        overallPastAccuracy,
        recentChatTopics,
        availableConcepts: candidateConcepts,
        materialsCount: materials.length,
        baseCurriculum,
      };
    } catch (error) {
      console.error('Error in understandCurrentLearningState:', error);
      return {
        projectContext: {
          projectId: projectId.toString(),
          projectName: 'Project',
          domain: 'python',
          textExcerpt: '',
          tutorSnippets: '',
        },
        masteryRecords: [],
        masteryMap: {},
        pastMistakes: [],
        questionHistory: new Set(),
        overallPastAccuracy: 50,
        recentChatTopics: '',
        availableConcepts: Object.keys(PYTHON_CURRICULUM),
        materialsCount: 0,
        baseCurriculum: PYTHON_CURRICULUM,
      };
    }
  },

  // 2. Multi-factor selection of Concept, Difficulty, and Question Type
  selectConceptAndDifficulty(learningState, session) {
    const { masteryMap, pastMistakes, recentChatTopics, availableConcepts, projectContext } = learningState;
    const sessionQuestions = session?.questions || [];
    const sessionAnswers = session?.answers || [];
    const sessionMistakes = session?.mistakes || [];
    const currentQuestionIndex = session?.currentQuestionIndex || 0;

    const testedInSessionCounts = {};
    sessionQuestions.forEach((q) => {
      testedInSessionCounts[q.concept] = (testedInSessionCounts[q.concept] || 0) + 1;
    });

    const lastAnswer = sessionAnswers.length > 0 ? sessionAnswers[sessionAnswers.length - 1] : null;
    const lastQuestion = sessionQuestions.length > 0 ? sessionQuestions[sessionQuestions.length - 1] : null;

    // Score concepts using multi-factor weights
    const conceptScores = availableConcepts.map((concept) => {
      let score = 0;
      const mastery = masteryMap[concept];
      const currentLevel = mastery ? mastery.level : 30;

      // 1. Mastery Deficit
      score += (100 - currentLevel) * 1.5;

      // 2. Status Weight
      if (mastery?.status === 'requiring_attention') {
        score += 35;
      } else if (mastery?.status === 'improving') {
        score += 10;
      }

      // 3. Previous Mistakes
      const pastMistakeHits = pastMistakes.filter((m) => m.concept && m.concept.toLowerCase() === concept.toLowerCase()).length;
      score += pastMistakeHits * 25;

      const sessionMistakeHits = sessionMistakes.filter((m) => m.concept && m.concept.toLowerCase() === concept.toLowerCase()).length;
      score += sessionMistakeHits * 30;

      // 4. Recent Learning Activity (topics mentioned in tutor chat)
      if (recentChatTopics && recentChatTopics.toLowerCase().includes(concept.toLowerCase().split(' ')[0])) {
        score += 25;
      }

      // 5. Diversity Penalty for concepts already tested in this session
      const timesTestedThisSession = testedInSessionCounts[concept] || 0;
      score -= timesTestedThisSession * 50;

      // 6. Spaced repetition for new concepts
      if (!mastery) {
        score += 20;
      }

      return { concept, score, currentLevel };
    });

    conceptScores.sort((a, b) => b.score - a.score);
    const selectedConceptItem = conceptScores[0] || { concept: availableConcepts[0], currentLevel: 40 };
    const selectedConcept = selectedConceptItem.concept;
    const currentConceptMastery = selectedConceptItem.currentLevel;

    // Determine Difficulty (Zone of Proximal Development)
    let difficulty = 'medium';
    let rationale = '';
    const domainLabel = projectContext?.domain ? projectContext.domain.toUpperCase() : 'SUBJECT';

    if (currentConceptMastery < 45) {
      difficulty = 'easy';
      if (lastAnswer && !lastAnswer.isCorrect && lastQuestion?.concept === selectedConcept) {
        rationale = `Targeting foundational "${selectedConcept}" in ${domainLabel} (Easy) to clarify misconceptions identified in your previous answer.`;
      } else {
        rationale = `Selected "${selectedConcept}" in ${domainLabel} (Easy) because current mastery is ${currentConceptMastery}%, focusing on core mechanisms.`;
      }
    } else if (currentConceptMastery >= 45 && currentConceptMastery <= 75) {
      difficulty = 'medium';
      if (lastAnswer && lastAnswer.isCorrect && lastQuestion?.concept === selectedConcept) {
        rationale = `Reinforcing "${selectedConcept}" in ${domainLabel} at Medium difficulty to evaluate your application after your recent correct response.`;
      } else {
        rationale = `Targeting "${selectedConcept}" in ${domainLabel} (Medium) to bridge your current ${currentConceptMastery}% mastery toward deeper reasoning.`;
      }
    } else {
      difficulty = 'hard';
      rationale = `Selected "${selectedConcept}" in ${domainLabel} (Hard) to challenge your strong ${currentConceptMastery}% mastery with advanced analytical reasoning.`;
    }

    // Question Type
    let type = 'mcq';
    if (currentQuestionIndex % 2 === 1) {
      type = 'open_ended';
    } else if (currentConceptMastery > 60 && currentQuestionIndex >= 2) {
      type = 'open_ended';
    } else {
      type = 'mcq';
    }

    return {
      concept: selectedConcept,
      difficulty,
      type,
      currentConceptMastery,
      rationale,
    };
  },

  // 3. Generate adaptive question strictly grounded in this project's domain and materials
  async generateAdaptiveQuestion(projectId, concept, difficulty, type, rationale, learningState) {
    const groqKey = getGroqApiKey();
    const projectContext = learningState?.projectContext || {};
    const domain = projectContext.domain || 'python';
    const projectName = projectContext.projectName || 'Project';
    const materialExcerpt = projectContext.textExcerpt || '';
    const tutorContext = projectContext.tutorSnippets || '';

    // 3.1 Try Groq LLM Generation with STRICT project isolation prompt
    if (groqKey) {
      try {
        const startTime = Date.now();
        const systemPrompt = `You are an expert pedagogical assessment engine for an AI Learning Companion.
You are generating a quiz question STRICTLY and EXCLUSIVELY for the project "${projectName}".
Subject Domain: ${domain.toUpperCase()}
Target Concept: "${concept}"
Difficulty Level: ${difficulty.toUpperCase()}
Question Type: ${type === 'mcq' ? 'Multiple-Choice (MCQ)' : 'Open-Ended Analytical Question'}
Pedagogical Goal: ${rationale}

CRITICAL STRICT ISOLATION RULES:
1. Every word, code snippet, question stem, and choice MUST be about ${domain.toUpperCase()} and the target concept "${concept}".
2. NEVER mention, ask about, or include syntax from other programming languages (e.g. if the domain is Python, NEVER use Java, C++, or JVM concepts. If the domain is Java, NEVER use Python syntax).
3. If reference text from uploaded materials or AI tutor context is provided below, directly ground the question in that content:
--- Project Learning Material Context ---
${materialExcerpt || 'No direct text excerpt available.'}
--- Recent Project AI Tutor Interactions ---
${tutorContext || 'No recent tutor discussions.'}

4. Output STRICTLY a single valid JSON object with no markdown fences, no backticks, no comments.
For MCQ format:
{
  "question": "Clear question stem in ${domain.toUpperCase()}",
  "type": "mcq",
  "choices": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": 0,
  "explanation": "Detailed explanation grounded in ${domain.toUpperCase()} principles.",
  "concept": "${concept}",
  "difficulty": "${difficulty}"
}

For Open-Ended format:
{
  "question": "Thoughtful conceptual or analytical question in ${domain.toUpperCase()} asking learner to explain mechanisms in their own words",
  "type": "open_ended",
  "rubric": {
    "keyConcepts": ["3-4 essential technical concepts or keywords required in ${domain.toUpperCase()}"],
    "guidelines": "Criteria for full credit",
    "sampleAnswer": "Comprehensive model answer demonstrating exemplary ${domain.toUpperCase()} understanding."
  },
  "explanation": "Summary of pedagogical focus.",
  "concept": "${concept}",
  "difficulty": "${difficulty}"
}`;

        const response = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Generate the ${difficulty} ${type} question on "${concept}" for project "${projectName}" (${domain.toUpperCase()}).` }
            ],
            temperature: 0.3,
            max_tokens: 1200,
            response_format: { type: 'json_object' },
          },
          {
            headers: {
              Authorization: `Bearer ${groqKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );

        const latencyMs = Date.now() - startTime;
        const rawContent = response.data.choices[0].message.content.trim();
        const generated = JSON.parse(rawContent);

        // Record AI Trace
        await AITrace.create({
          projectId,
          feature: 'quiz_generation',
          query: `Generate ${difficulty} ${type} on ${concept} (${domain})`,
          model: 'llama-3.3-70b-versatile',
          latencyMs,
          tokensUsed: response.data.usage?.total_tokens || 0,
          success: true,
        });

        return {
          question: generated.question,
          type: generated.type || type,
          choices: generated.choices || [],
          correctAnswer: generated.correctAnswer !== undefined ? generated.correctAnswer : null,
          concept,
          difficulty,
          explanation: generated.explanation || '',
          rubric: generated.rubric || null,
          adaptiveRationale: rationale,
        };
      } catch (groqErr) {
        console.warn(`[Groq Generation] Groq call failed (${groqErr.message}). Using domain-isolated fallback for ${domain}.`);
      }
    }

    // 3.2 Fallback: STRICTLY use the curriculum corresponding to THIS project's domain
    let curriculum = PYTHON_CURRICULUM;
    if (domain === 'java') {
      curriculum = JAVA_CURRICULUM;
    } else if (domain === 'javascript') {
      curriculum = JAVASCRIPT_CURRICULUM;
    }

    const conceptData = curriculum[concept] || Object.values(curriculum)[0];
    const candidates = conceptData.questions.filter((q) => q.type === type && (q.difficulty === difficulty || true));
    const selectedTemplate = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : conceptData.questions[0];

    return {
      question: selectedTemplate.question,
      type: selectedTemplate.type,
      choices: selectedTemplate.choices || [],
      correctAnswer: selectedTemplate.correctAnswer !== undefined ? selectedTemplate.correctAnswer : null,
      concept,
      difficulty,
      explanation: selectedTemplate.explanation || '',
      rubric: selectedTemplate.rubric || null,
      adaptiveRationale: rationale,
    };
  },

  // 4. Evaluate Answer with project domain grounding
  async evaluateAnswer(question, userAnswer, projectId, userId) {
    const startTime = Date.now();

    // 4.1 MCQ Evaluation
    if (question.type === 'mcq') {
      const isCorrect =
        question.correctAnswer === userAnswer ||
        String(question.correctAnswer) === String(userAnswer);

      const score = isCorrect ? 100 : 0;
      const feedback = isCorrect
        ? `Correct! ${question.explanation || 'Great job understanding this concept.'}`
        : `Incorrect. The correct answer was: "${question.choices[question.correctAnswer]}". ${question.explanation || ''}`;

      return {
        isCorrect,
        score,
        feedback,
        detailedEvaluation: {
          understanding: isCorrect ? 'Demonstrated solid grasp of the core rule.' : 'Misidentified the key mechanism.',
          accuracy: isCorrect ? '100% accurate choice.' : 'Selected distractor.',
          relevance: 'Direct answer to multiple choice prompt.',
          keyConceptsCovered: isCorrect ? [question.concept] : [],
          missingConcepts: isCorrect ? [] : [question.concept],
          reasoning: isCorrect ? 'Correct deduction.' : 'Misunderstood option implications.',
        },
      };
    }

    // 4.2 Open-Ended Question Evaluation via Groq AI
    const groqKey = getGroqApiKey();
    if (groqKey && userAnswer && typeof userAnswer === 'string' && userAnswer.trim().length > 5) {
      try {
        const evalPrompt = `You are a fair, pedagogical AI evaluator for a learner studying computer science.
Evaluate the student's open-ended response to the following question.

Question: "${question.question}"
Concept: "${question.concept}"
Target Difficulty: "${question.difficulty}"
Rubric Expected Key Concepts: ${JSON.stringify(question.rubric?.keyConcepts || [])}
Rubric Guidelines: "${question.rubric?.guidelines || ''}"
Sample Model Answer: "${question.rubric?.sampleAnswer || ''}"

Student's Answer:
"""${userAnswer.trim()}"""

Evaluate across these 7 factors:
1. understanding: What did the learner grasp well conceptually?
2. accuracy: Are technical statements factual and correct?
3. relevance: Does the answer directly address the question?
4. keyConceptsCovered: Array of key concepts or terms successfully demonstrated.
5. missingConcepts: Array of required concepts or nuances omitted.
6. reasoning: Quality of logical structure and explanation.
7. score: Integer from 0 to 100 representing overall quality.
8. feedback: Clear, encouraging explanation detailing what the learner understood and what is missing rather than returning only a numerical score.

Output strictly a single JSON object with these exact keys:
{
  "score": 85,
  "isCorrect": true,
  "understanding": "...",
  "accuracy": "...",
  "relevance": "...",
  "keyConceptsCovered": ["..."],
  "missingConcepts": ["..."],
  "reasoning": "...",
  "feedback": "What was understood: ... What is missing: ..."
}`;

        const response = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'system', content: evalPrompt }],
            temperature: 0.2,
            max_tokens: 1000,
            response_format: { type: 'json_object' },
          },
          {
            headers: {
              Authorization: `Bearer ${groqKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );

        const latencyMs = Date.now() - startTime;
        const evaluation = JSON.parse(response.data.choices[0].message.content.trim());

        // Log AI trace
        await AITrace.create({
          projectId,
          userId,
          feature: 'answer_evaluation',
          query: `Evaluate response for: ${question.question.slice(0, 50)}...`,
          model: 'llama-3.3-70b-versatile',
          tokensUsed: response.data.usage?.total_tokens || 0,
          latencyMs,
          success: true,
        });

        const score = Math.max(0, Math.min(100, Number(evaluation.score) || 0));
        return {
          isCorrect: score >= 60,
          score,
          feedback: evaluation.feedback || 'Response evaluated.',
          detailedEvaluation: {
            understanding: evaluation.understanding || 'Evaluated.',
            accuracy: evaluation.accuracy || 'Evaluated.',
            relevance: evaluation.relevance || 'Directly relevant.',
            keyConceptsCovered: Array.isArray(evaluation.keyConceptsCovered) ? evaluation.keyConceptsCovered : [],
            missingConcepts: Array.isArray(evaluation.missingConcepts) ? evaluation.missingConcepts : [],
            reasoning: evaluation.reasoning || 'Satisfactory reasoning.',
          },
        };
      } catch (groqErr) {
        console.warn('Groq evaluation failed. Using rubric heuristic evaluation:', groqErr.message);
      }
    }

    // 4.3 Rubric Heuristic Fallback
    const userText = (userAnswer || '').toLowerCase();
    const expectedKeys = question.rubric?.keyConcepts || [question.concept];
    const matchedKeys = [];
    const missedKeys = [];

    expectedKeys.forEach((key) => {
      const words = key.toLowerCase().split(' ').filter((w) => w.length > 3);
      const isMatched = words.some((w) => userText.includes(w));
      if (isMatched) {
        matchedKeys.push(key);
      } else {
        missedKeys.push(key);
      }
    });

    const matchRatio = expectedKeys.length > 0 ? matchedKeys.length / expectedKeys.length : 0.5;
    const lengthScore = Math.min(1, userText.length / 150);
    const calculatedScore = Math.round((matchRatio * 0.7 + lengthScore * 0.3) * 100);
    const isCorrect = calculatedScore >= 55;

    const feedback = isCorrect
      ? `Good conceptual demonstration! You correctly addressed: ${matchedKeys.join(', ') || 'the key requirements'}.${
          missedKeys.length > 0 ? ` To deepen your answer, consider expanding on: ${missedKeys.join(', ')}.` : ''
        }`
      : `Your answer partially addressed the topic, but missed essential aspects: ${missedKeys.join(', ') || question.concept}. Review how ${question.concept} operates in practice.`;

    return {
      isCorrect,
      score: calculatedScore,
      feedback,
      detailedEvaluation: {
        understanding: isCorrect
          ? 'Clear grasp of the fundamental principle.'
          : 'Developing understanding; needs additional precision regarding technical definitions.',
        accuracy: isCorrect ? 'Statements are generally accurate and relevant.' : 'Incomplete technical precision.',
        relevance: userText.length > 10 ? 'Directly addresses the question prompt.' : 'Answer is brief.',
        keyConceptsCovered: matchedKeys,
        missingConcepts: missedKeys,
        reasoning: isCorrect
          ? 'Logical progression from definition to application.'
          : 'Reasoning could be elaborated with examples.',
      },
    };
  },

  // 5. Update Concept Mastery and Growth System
  async updateMasteryAndRecommendations({ projectId, userId, concept, isCorrect, score, questionType, feedback }) {
    let mastery = await Mastery.findOne({ projectId, userId, concept });
    const beforeLevel = mastery ? mastery.level : 30;

    const weight = questionType === 'open_ended' ? 0.45 : 0.35;
    const newLevel = Math.round(beforeLevel * (1 - weight) + score * weight);

    let newStatus = 'requiring_attention';
    if (newLevel >= 75) {
      newStatus = 'improving';
    } else if (newLevel >= 50) {
      newStatus = 'stable';
    }

    if (!mastery) {
      mastery = new Mastery({
        projectId,
        userId,
        concept,
        level: newLevel,
        status: newStatus,
        history: [{ level: newLevel, source: 'quiz', recordedAt: new Date() }],
      });
    } else {
      mastery.level = newLevel;
      mastery.status = newStatus;
      mastery.history.push({ level: newLevel, source: 'quiz', recordedAt: new Date() });
      mastery.updatedAt = new Date();
    }

    await mastery.save();

    const change = newLevel - beforeLevel;

    if (newLevel < 60) {
      const existingRec = await Recommendation.findOne({
        projectId,
        userId,
        targetConcept: concept,
        isCompleted: false,
      });

      if (!existingRec) {
        await Recommendation.create({
          projectId,
          userId,
          title: `Reinforce ${concept}`,
          text: `Your current mastery on "${concept}" is ${newLevel}%. Review the course materials and discuss common misconceptions with the AI Tutor.`,
          actionType: 'reinforce_concept',
          targetConcept: concept,
          isCompleted: false,
        });
      }
    } else if (newLevel >= 80) {
      await Recommendation.updateMany(
        { projectId, userId, targetConcept: concept, isCompleted: false },
        { $set: { isCompleted: true } }
      );
    }

    return {
      concept,
      beforeLevel,
      afterLevel: newLevel,
      change,
      status: newStatus,
    };
  },
};

module.exports = AdaptiveQuizEngine;
