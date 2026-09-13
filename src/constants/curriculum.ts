// src/constants/curriculum.ts

export const CURRICULUM = {
  physics: {
    name: "Physics",
    slug: "physics",
    sections: {
      mechanics: {
        name: "Mechanics",
        slug: "mechanics",

        chapters: [
          {
            name: "Physical Quantities",
            slug: "physical-quantities",
            grade: 11,
          },
          {
            name: "Vectors",
            slug: "vectors",
            grade: 11,
          },
          {
            name: "Kinematics",
            slug: "kinematics",
            grade: 11,
          },
          {
            name: "Dynamics",
            slug: "dynamics",
            grade: 11,
          },
          {
            name: "Work, Energy, and Power",
            slug: "work-energy-and-power",
            grade: 11,
          },
          {
            name: "Circular Motion",
            slug: "circular-motion",
            grade: 11,
          },
          {
            name: "Gravitation",
            slug: "gravitation",
            grade: 11,
          },
          {
            name: "Rotational Dynamics",
            slug: "rotational-dynamics",
            grade: 12,
          },
          {
            name: "Simple Harmonic Motion",
            slug: "shm",
            grade: 12,
          },
          {
            name: "Fluid Mechanics",
            slug: "fluid-mechanics",
            grade: 12,
          },
        ],
      },

      thermodynamics: {
        name: "Heat and Thermodynamics",
        slug: "heat-and-thermodynamics",

        chapters: [
          {
            name: "Heat and Temperature",
            slug: "heat-and-temperature",
            grade: 11,
          },
          {
            name: "Thermal Expansion",
            slug: "thermal-expansion",
            grade: 11,
          },
          {
            name: "Quantity of Heat",
            slug: "quantity-of-heat",
            grade: 11,
          },
          {
            name: "Rate of Heat Flow",
            slug: "rate-of-heat-flow",
            grade: 11,
          },
          {
            name: "Ideal Gas",
            slug: "ideal-gas",
            grade: 11,
          },
          {
            name: "First Law of Thermodynamics",
            slug: "first-law-of-thermodynamics",
            grade: 12,
          },
          {
            name: "Second Law of Thermodynamics",
            slug: "second-law-of-thermodynamics",
            grade: 12,
          },
        ],
      },

      soundAndWaves: {
        name: "Sound and Waves",
        slug: "sound-and-waves",
        chapters: [
          {
            name: "Wave Motion",
            slug: "wave-motion",
            grade: 12,
          },
          {
            name: "Mechanical Waves",
            slug: "mechanical-waves",
            grade: 12,
          },
          {
            name: "Waves in Pipes and Strings",
            slug: "waves-in-pipes-and-strings",
            grade: 12,
          },
          {
            name: "Acoustic Phenomena",
            slug: "acoustic-phenomena",
            grade: 12,
          },
        ],
      },

      optics: {
        name: "Optics",
        slug: "optics",
        chapters: [
          {
            name: "Reflection in Mirrors",
            slug: "reflection-in-mirrors",
            grade: 11,
          },
          {
            name: "Refraction in Plane Surfaces and Prisms",
            slug: "refraction-in-plane-surfaces-and-prisms",
            grade: 11,
          },
          {
            name: "Lenses",
            slug: "lenses",
            grade: 11,
          },
          {
            name: "Dispersion",
            slug: "dispersion",
            grade: 11,
          },
          {
            name: "Nature and Propagation of Light",
            slug: "nature-and-propagation-of-light",
            grade: 12,
          },
          {
            name: "Interference",
            slug: "interference",
            grade: 12,
          },
          {
            name: "Diffraction",
            slug: "diffraction",
            grade: 12,
          },
          {
            name: "Polarization",
            slug: "polarization",
            grade: 12,
          },
        ],
      },

      electrostatics: {
        name: "Electrostatics",
        slug: "electrostatics",

        chapters: [
          {
            name: "Electric Charges",
            slug: "electric-charges",
            grade: 11,
          },
          {
            name: "Electric Field and Potential",
            slug: "electric-field-and-potential",
            grade: 11,
          },
          {
            name: "Capacitors and Capacitance",
            slug: "capacitors-and-capacitance",
            grade: 11,
          },
        ],
      },

      currentElectricityAndMagnetism: {
        name: "Current Electricity and Magnetism",
        slug: "current-electricity-and-magnetism",

        chapters: [
          {
            name: "Current Electricity and DC Circuits",
            slug: "current-electricity-and-dc-circuits",
            grade: 11,
          },
          {
            name: "Electrical Circuits and Measurements",
            slug: "electrical-circuits-and-measurements",
            grade: 12,
          },
          {
            name: "Thermoelectric Effects",
            slug: "thermoelectric-effects",
            grade: 12,
          },
          {
            name: "Electromagnetic Induction",
            slug: "electromagnetic-induction",
            grade: 12,
          },
          {
            name: "Alternating Current",
            slug: "alternating-current",
            grade: 12,
          },
          {
            name: "Magnetic Effect of Current",
            slug: "magnetic-effect-of-current",
            grade: 12,
          },
          {
            name: "Magnetism and Magnetic Materials",
            slug: "magnetism-and-magnetic-materials",
            grade: 12,
          },
        ],
      },

      modernPhysics: {
        name: "Modern Physics",
        slug: "modern-physics",

        chapters: [
          {
            name: "Electrons and Protons",
            slug: "electrons-and-protons",
            grade: 12,
          },
          {
            name: "Photons and Photoelectric Effects",
            slug: "photons-and-photoelectric-effects",
            grade: 12,
          },
          {
            name: "Atomic Models",
            slug: "atomic-models",
            grade: 12,
          },
          {
            name: "X-rays",
            slug: "x-rays",
            grade: 12,
          },
          {
            name: "Logic Gates",
            slug: "logic-gates",
            grade: 12,
          },

          {
            name: "Nuclear Physics and Radioactivity",
            slug: "nuclear-physics-and-radioactivity",
            grade: 12,
          },
          {
            name: "Solids and Semiconductor Devices",
            slug: "solids-semiconductor-devices",
            grade: 12,
          },
          {
            name: "Recent Trends in Physics",
            slug: "recent-trends-in-physics",
            grade: 12,
          },
        ],
      },
    },
  },

  chemistry: {
    name: "Chemistry",
    slug: "chemistry",

    sections: {
      generalAndPhysicalChemistry: {
        name: "General and Physical Chemistry",
        slug: "general-and-physical-chemistry",

        chapters: [
          {
            name: "Stoichiometry",
            slug: "stoichiometry",
            grade: 11,
          },
          {
            name: "Atomic Structure",
            slug: "atomic-structure",
            grade: 11,
          },
          {
            name: "Classification of Elements and Periodic Table",
            slug: "classification-of-elements-and-periodic-table",
            grade: 11,
          },
          {
            name: "Chemical Bonding and Shapes of Molecules",
            slug: "chemical-bonding-and-shapes-of-molecules",
            grade: 11,
          },
          {
            name: "Oxidation and Reduction",
            slug: "oxidation-and-reduction",
            grade: 11,
          },
          {
            name: "States of Matter",
            slug: "states-of-matter",
            grade: 11,
          },
          {
            name: "Chemical Equilibrium",
            slug: "chemical-equilibrium",
            grade: 11,
          },
          {
            name: "Volumetric Analysis",
            slug: "volumetric-analysis",
            grade: 12,
          },
          {
            name: "Ionic Equilibrium",
            slug: "ionic-equilibrium",
            grade: 12,
          },
          {
            name: "Chemical Kinetics",
            slug: "chemical-kinetics",
            grade: 12,
          },
          {
            name: "Thermodynamics",
            slug: "thermodynamics",
            grade: 12,
          },
          {
            name: "Electrochemistry",
            slug: "electrochemistry",
            grade: 12,
          },
        ],
      },

      organicChemistry: {
        name: "Organic Chemistry",
        slug: "organic-chemistry",

        chapters: [
          {
            name: "Fundamentals of Organic Chemistry",
            slug: "fundamentals-of-organic-chemistry",
            grade: 11,
          },
          {
            name: "Hydrocarbons",
            slug: "hydrocarbons",
            grade: 11,
          },
          {
            name: "Haloalkanes",
            slug: "haloalkanes",
            grade: 12,
          },
          {
            name: "Haloarenes",
            slug: "haloarenes",
            grade: 12,
          },
          {
            name: "Alcohols",
            slug: "alcohols",
            grade: 12,
          },
          {
            name: "Phenols",
            slug: "phenols",
            grade: 12,
          },
          {
            name: "Ethers",
            slug: "ethers",
            grade: 12,
          },
          {
            name: "Aldehydes and Ketones",
            slug: "aldehydes-and-ketones",
            grade: 12,
          },
          {
            name: "Carboxylic Acid and Its Derivatives",
            slug: "carboxylic-acid-and-its-derivatives",
            grade: 12,
          },
          {
            name: "Nitro Compounds",
            slug: "nitro-compounds",
            grade: 12,
          },
          {
            name: "Amines",
            slug: "amines",
            grade: 12,
          },
          {
            name: "Organometallic Compounds",
            slug: "organometallic-compounds",
            grade: 12,
          },
        ],
      },

      inorganicChemistry: {
        name: "Inorganic Chemistry",
        slug: "inorganic-chemistry",
        chapters: [
          {
            name: "Nitrogen and Its Compounds",
            slug: "nitrogen-and-its-compounds",
          },
          {
            name: "Halogens and Halogen Acids",
            slug: "halogens-and-halogen-acids",
          },
          {
            name: "Carbon and Its Compounds",
            slug: "carbon-and-its-compounds",
          },
          {
            name: "Oxygen and Oxides",
            slug: "oxygen-and-oxides",
          },
          {
            name: "Hydrogen",
            slug: "hydrogen",
          },
          {
            name: "Metallurgical Principles",
            slug: "metallurgical-principles",
          },
          {
            name: "Transition Metals",
            slug: "transition-metals",
          },
          {
            name: "Alkali Metals and Alkaline Earth Metals",
            slug: "alkali-metals-and-alkaline-earth-metals",
          },
          {
            name: "Copper and Its Compounds",
            slug: "copper-and-its-compounds",
          },
          {
            name: "Zinc and Its Compounds",
            slug: "zinc-and-its-compounds",
          },
          {
            name: "Mercury and Its Compounds",
            slug: "mercury-and-its-compounds",
          },
          {
            name: "Iron and Its Compounds",
            slug: "iron-and-its-compounds",
          },
          {
            name: "Silver and Its Compounds",
            slug: "silver-and-its-compounds",
          },
        ],
      },
    },
  },

  mathematics: {
    name: "Mathematics",
    slug: "mathematics",

    sections: {
      setLogicAndFunctions: {
        name: "Set, Logic and Functions",
        slug: "set-logic-and-functions",
        chapters: [
          {
            name: "Set and Logic",
            slug: "set-and-logic",
          },
          {
            name: "Real Number System",
            slug: "real-number-system",
          },
          {
            name: "Relation and Function",
            slug: "relation-and-function",
          },
        ],
      },

      algebra: {
        name: "Algebra",
        slug: "algebra",
        chapters: [
          {
            name: "Complex Numbers",
            slug: "complex-numbers",
          },
          {
            name: "Polynomial Equations",
            slug: "polynomial-equations",
          },
          {
            name: "Sequence and Series",
            slug: "sequence-and-series",
          },
          {
            name: "Matrices and Determinants",
            slug: "matrices-and-determinants",
          },
          {
            name: "System of Linear Equations",
            slug: "system-of-linear-equations",
          },
          {
            name: "Binomial Expansion",
            slug: "binomial-expansion",
          },
          {
            name: "Exponential and Logarithmic Series",
            slug: "exponential-and-logarithmic-series",
          },
          {
            name: "Permutation and Combination",
            slug: "permutation-and-combination",
          },
        ],
      },

      calculus: {
        name: "Calculus",
        slug: "calculus",
        chapters: [
          {
            name: "Limit and Continuity",
            slug: "limit-and-continuity",
          },
          {
            name: "Differentiation or Derivatives",
            slug: "differentiation-or-derivatives",
          },
          {
            name: "Antiderivative",
            slug: "antiderivative",
          },
          {
            name: "Definite Integrals",
            slug: "definite-integrals",
          },
          {
            name: "Application of Derivative",
            slug: "application-of-derivative",
          },
          {
            name: "Application of Antiderivatives",
            slug: "application-of-antiderivatives",
          },
          {
            name: "Differential Equations",
            slug: "differential-equations",
          },
        ],
      },

      vectors: {
        name: "Vectors",
        slug: "vectors",
        chapters: [
          {
            name: "Vectors and Vector Algebra",
            slug: "vectors-and-vector-algebra",
          },
          {
            name: "Vector Products",
            slug: "vector-products",
          },
        ],
      },

      probabilityAndStatistics: {
        name: "Probability And Statistics",
        slug: "probability-and-statistics",

        chapters: [
          { name: "Statistics", slug: "statistics" },
          {
            name: "Probability",
            slug: "probability",
          },
        ],
      },

      coordinateGeometry: {
        name: "Coordinate Geometry",
        slug: "coordinate-geometry",
        chapters: [
          {
            name: "Straight Lines",
            slug: "straight-lines",
          },
          {
            name: "Pair of Lines",
            slug: "pair-of-lines",
          },
          {
            name: "Circles",
            slug: "circles",
          },
          {
            name: "Parabola",
            slug: "parabola",
          },
          {
            name: "Ellipse",
            slug: "ellipse",
          },
          {
            name: "Hyperbola",
            slug: "hyperbola",
          },
          {
            name: "Coordinate in Space",
            slug: "coordinate-in-space",
          },
          {
            name: "Plane",
            slug: "plane",
          },
        ],
      },

      trigonometry: {
        name: "Trigonometry",
        slug: "trigonometry",
        chapters: [
          {
            name: "Trigonometric Equations and General Values",
            slug: "trigonometric-equations-and-general-values",
          },
          {
            name: "Inverse Circular Function",
            slug: "inverse-circular-function",
          },
          {
            name: "Properties of Triangle",
            slug: "properties-of-triangle",
          },
        ],
      },
    },
  },

  english: {
    name: "English",
    slug: "english",

    sections: {
      grammar: {
        name: "Grammar",
        slug: "grammar",
        chapters: [
          {
            name: "Conditional Sentences",
            slug: "conditional-sentences",
          },
          {
            name: "Causative Verbs",
            slug: "causative-verbs",
          },
          {
            name: "Kinds of Sentences",
            slug: "kinds-of-sentences",
          },
          {
            name: "Sentences",
            slug: "sentences",
          },
          {
            name: "Tenses and Aspects",
            slug: "tenses-and-aspects",
          },
          {
            name: "Use of Prepositions",
            slug: "use-of-prepositions",
          },
          {
            name: "Subject-Verb Agreement",
            slug: "subject-verb-agreement",
          },
          {
            name: "Infinitives and Gerunds",
            slug: "infinitives-and-gerunds",
          },
          {
            name: "Relative Pronouns",
            slug: "relative-pronouns",
          },
          {
            name: "Sound and Word Stress",
            slug: "sound-and-word-stress",
          },
          {
            name: "Direct and Indirect Speech",
            slug: "direct-and-indirect-speech",
          },
          {
            name: "Active and Passive Voice",
            slug: "active-and-passive-voice",
          },
          {
            name: "Use of Articles",
            slug: "use-of-articles",
          },
          {
            name: "Synonyms and Antonyms",
            slug: "synonyms-and-antonyms",
          },
          {
            name: "Punctuation",
            slug: "punctuation",
          },
          {
            name: "Phonemes",
            slug: "phonemes",
          },
        ],
      },

      comprehension: {
        name: "Comprehension",
        slug: "comprehension",
        chapters: [
          {
            name: "Reading Comprehension",
            slug: "reading-comprehension",
          },
        ],
      },
    },
  },
} as const;
