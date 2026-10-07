// src/constants/curriculum.ts

export const CURRICULUM = {
  physics: {
    name: "Physics",
    slug: "physics",
    sections: {
      mechanics: {
        name: "Mechanics",
        slug: "mechanics",
        description:
          "Motion and forces: bodies at rest or in motion under forces, energy, rotation, oscillations and fluids.",

        chapters: [
          {
            name: "Physical Quantities",
            slug: "physical-quantities",
            grade: 11,
            description:
              "Units, dimensions, measurement errors and the physical quantities used to describe motion.",
          },
          {
            name: "Vectors",
            slug: "vectors",
            grade: 11,
            description:
              "Vector addition, resolution, components and vector algebra applied to physical quantities.",
          },
          {
            name: "Kinematics",
            slug: "kinematics",
            grade: 11,
            description:
              "Motion in a straight line and in a plane: displacement, velocity, acceleration and graphs.",
          },
          {
            name: "Dynamics",
            slug: "dynamics",
            grade: 11,
            description:
              "Newton's laws of motion, forces, friction, connected bodies and inertial frames.",
          },
          {
            name: "Work, Energy, and Power",
            slug: "work-energy-and-power",
            grade: 11,
            description:
              "Work, energy, power, the work-energy theorem and conservation of energy.",
          },
          {
            name: "Circular Motion",
            slug: "circular-motion",
            grade: 11,
            description:
              "Uniform and non-uniform circular motion, centripetal force and conical pendulum.",
          },
          {
            name: "Gravitation",
            slug: "gravitation",
            grade: 11,
            description:
              "Universal gravitation, acceleration due to gravity, Kepler's laws and orbital motion.",
          },
          {
            name: "Rotational Dynamics",
            slug: "rotational-dynamics",
            grade: 12,
            description:
              "Moment of inertia, torque, angular momentum, rolling motion and rotational equilibrium.",
          },
          {
            name: "Simple Harmonic Motion",
            slug: "shm",
            grade: 12,
            description:
              "Simple harmonic motion: defining equation, energy, spring-mass system and pendulums.",
          },
          {
            name: "Fluid Mechanics",
            slug: "fluid-mechanics",
            grade: 12,
            description:
              "Pressure, Archimedes' principle, Bernoulli's theorem and viscosity of fluids.",
          },
        ],
      },

      thermodynamics: {
        name: "Heat and Thermodynamics",
        slug: "heat-and-thermodynamics",
        description:
          "Heat, temperature, thermal expansion, heat transfer, gases and the laws of thermodynamics.",

        chapters: [
          {
            name: "Heat and Temperature",
            slug: "heat-and-temperature",
            grade: 11,
            description:
              "Thermal equilibrium, thermometry, calorimetry and the kinetic theory basis of temperature.",
          },
          {
            name: "Thermal Expansion",
            slug: "thermal-expansion",
            grade: 11,
            description:
              "Linear, surface and volumetric expansion of solids and liquids, and anomalous expansion of water.",
          },
          {
            name: "Quantity of Heat",
            slug: "quantity-of-heat",
            grade: 11,
            description:
              "Specific and latent heat, calorimetry, phase change and heat energy calculations.",
          },
          {
            name: "Rate of Heat Flow",
            slug: "rate-of-heat-flow",
            grade: 11,
            description:
              "Conduction, convection and radiation; thermal conductivity and cooling laws.",
          },
          {
            name: "Ideal Gas",
            slug: "ideal-gas",
            grade: 11,
            description:
              "Ideal gas equation, kinetic theory of gases, degrees of freedom and gas laws.",
          },
          {
            name: "First Law of Thermodynamics",
            slug: "first-law-of-thermodynamics",
            grade: 12,
            description:
              "Internal energy, sign conventions for heat and work, thermodynamic processes and the first law.",
          },
          {
            name: "Second Law of Thermodynamics",
            slug: "second-law-of-thermodynamics",
            grade: 12,
            description:
              "Entropy, heat engines, refrigerators, the Carnot cycle and statements of the second law.",
          },
        ],
      },

      soundAndWaves: {
        name: "Sound and Waves",
        slug: "sound-and-waves",
        description:
          "General wave behaviour, mechanical waves, standing waves in media and sound phenomena.",
        chapters: [
          {
            name: "Wave Motion",
            slug: "wave-motion",
            grade: 12,
            description:
              "Transverse and longitudinal waves, wave parameters, superposition, interference and the Doppler effect.",
          },
          {
            name: "Mechanical Waves",
            slug: "mechanical-waves",
            grade: 12,
            description:
              "Wave speed and energy transfer in elastic media, and the physics of wave propagation.",
          },
          {
            name: "Waves in Pipes and Strings",
            slug: "waves-in-pipes-and-strings",
            grade: 12,
            description:
              "Standing waves, harmonics and overtones in open/closed pipes and vibrating strings.",
          },
          {
            name: "Acoustic Phenomena",
            slug: "acoustic-phenomena",
            grade: 12,
            description:
              "Sound production and perception: intensity, resonance, beats, noise and the human ear.",
          },
        ],
      },

      optics: {
        name: "Optics",
        slug: "optics",
        description:
          "Light: reflection, refraction, lenses, dispersion and its wave nature including interference.",
        chapters: [
          {
            name: "Reflection in Mirrors",
            slug: "reflection-in-mirrors",
            grade: 11,
            description:
              "The law of reflection, spherical mirrors, image formation, mirror formula and magnification.",
          },
          {
            name: "Refraction in Plane Surfaces and Prisms",
            slug: "refraction-in-plane-surfaces-and-prisms",
            grade: 11,
            description:
              "Snell's law, critical angle, total internal reflection, prism deviation and dispersion.",
          },
          {
            name: "Lenses",
            slug: "lenses",
            grade: 11,
            description:
              "Thin lenses, lens formula, magnification, lens combinations and optical instruments.",
          },
          {
            name: "Dispersion",
            slug: "dispersion",
            grade: 11,
            description:
              "Dispersive power, the wavelength dependence of refractive index and chromatic phenomena.",
          },
          {
            name: "Nature and Propagation of Light",
            slug: "nature-and-propagation-of-light",
            grade: 12,
            description:
              "Wave and particle nature of light, Huygens' principle and the electromagnetic spectrum.",
          },
          {
            name: "Interference",
            slug: "interference",
            grade: 12,
            description:
              "Young's double slit, fringe width, coherent sources and thin-film interference.",
          },
          {
            name: "Diffraction",
            slug: "diffraction",
            grade: 12,
            description:
              "Single slit diffraction, diffraction gratings, resolving power and the limit of resolution.",
          },
          {
            name: "Polarization",
            slug: "polarization",
            grade: 12,
            description:
              "Malus' law, Brewster's law, polaroids and evidence for the transverse nature of light.",
          },
        ],
      },

      electrostatics: {
        name: "Electrostatics",
        slug: "electrostatics",
        description:
          "Electric charges at rest: charge behaviour, electric fields and potentials, and capacitors.",

        chapters: [
          {
            name: "Electric Charges",
            slug: "electric-charges",
            grade: 11,
            description:
              "Coulomb's law, superposition of charges, conductors, electrostatic induction and Gauss's law.",
          },
          {
            name: "Electric Field and Potential",
            slug: "electric-field-and-potential",
            grade: 11,
            description:
              "Electric field lines, field due to continuous charge distributions, potential and equipotential surfaces.",
          },
          {
            name: "Capacitors and Capacitance",
            slug: "capacitors-and-capacitance",
            grade: 11,
            description:
              "Capacitance, the parallel plate capacitor, series/parallel combination, stored energy and dielectrics.",
          },
        ],
      },

      currentElectricityAndMagnetism: {
        name: "Current Electricity and Magnetism",
        slug: "current-electricity-and-magnetism",
        description:
          "Electric currents, circuits, measurements, electromagnetic induction and magnetic effects.",

        chapters: [
          {
            name: "Current Electricity and DC Circuits",
            slug: "current-electricity-and-dc-circuits",
            grade: 11,
            description:
              "Ohm's law, Kirchhoff's laws, EMF, internal resistance, the Wheatstone bridge and meter bridge.",
          },
          {
            name: "Electrical Circuits and Measurements",
            slug: "electrical-circuits-and-measurements",
            grade: 12,
            description:
              "Ammeters, voltmeters, potentiometers, measurement of resistance and error analysis.",
          },
          {
            name: "Thermoelectric Effects",
            slug: "thermoelectric-effects",
            grade: 12,
            description:
              "The Seebeck, Peltier and Thomson effects, thermocouples and compensation of the cold junction.",
          },
          {
            name: "Electromagnetic Induction",
            slug: "electromagnetic-induction",
            grade: 12,
            description:
              "Faraday's law, Lenz's law, motional EMF, self and mutual inductance and eddy currents.",
          },
          {
            name: "Alternating Current",
            slug: "alternating-current",
            grade: 12,
            description:
              "AC fundamentals, RMS values, phasors, LCR circuits, resonance, Q factor and power factor.",
          },
          {
            name: "Magnetic Effect of Current",
            slug: "magnetic-effect-of-current",
            grade: 12,
            description:
              "The Biot-Savart law, Ampere's law, force on a current carrying conductor and moving coil galvanometers.",
          },
          {
            name: "Magnetism and Magnetic Materials",
            slug: "magnetism-and-magnetic-materials",
            grade: 12,
            description:
              "Magnetic fields, earth magnetism, magnetisation, hysteresis and soft versus hard magnets.",
          },
        ],
      },

      modernPhysics: {
        name: "Modern Physics",
        slug: "modern-physics",
        description:
          "Atomic and nuclear physics, electrons and photons, semiconductors and contemporary topics.",

        chapters: [
          {
            name: "Electrons and Protons",
            slug: "electrons-and-protons",
            grade: 12,
            description:
              "Electron and proton properties, charge-to-mass ratio, Millikan's experiment and cathode rays. Motion of charged particle/electron in electro-magnetic and cross-fields.",
          },
          {
            name: "Photons and Photoelectric Effects",
            slug: "photons-and-photoelectric-effects",
            grade: 12,
            description:
              "The photon concept, the photoelectric effect, work function, Einstein's equation and applications.",
          },
          {
            name: "Atomic Models",
            slug: "atomic-models",
            grade: 12,
            description:
              "Rutherford, Bohr and quantum models of the atom, atomic spectra and energy levels.",
          },
          {
            name: "X-rays",
            slug: "x-rays",
            grade: 12,
            description:
              "Production of X-rays, continuous and characteristic spectra, Moseley's law and their uses.",
          },
          {
            name: "Logic Gates",
            slug: "logic-gates",
            grade: 12,
            description:
              "Boolean algebra, logic gates, truth tables and basic digital circuits.",
          },

          {
            name: "Nuclear Physics and Radioactivity",
            slug: "nuclear-physics-and-radioactivity",
            grade: 12,
            description:
              "Nuclear binding energy, fission, fusion, radioactive decay and half-life.",
          },
          {
            name: "Solids and Semiconductor Devices",
            slug: "solids-semiconductor-devices",
            grade: 12,
            description:
              "Energy bands, intrinsic and extrinsic semiconductors, the p-n junction, diodes and transistors.",
          },
          {
            name: "Recent Trends in Physics",
            slug: "recent-trends-in-physics",
            grade: 12,
            description:
              "Contemporary developments: lasers, superconductivity, nanotechnology, space science and quantum technology.",
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
        description:
          "Quantitative, atomic, bonding and physical chemistry: stoichiometry, bonding, equilibrium, kinetics and electrochemistry.",

        chapters: [
          {
            name: "Stoichiometry",
            slug: "stoichiometry",
            grade: 11,
            description:
              "The mole concept, stoichiometric calculations, limiting reagent, empirical and molecular formulae.",
          },
          {
            name: "Atomic Structure",
            slug: "atomic-structure",
            grade: 11,
            description:
              "Sub-atomic particles, the Bohr model, quantum numbers, electronic configuration and spectra.",
          },
          {
            name: "Classification of Elements and Periodic Table",
            slug: "classification-of-elements-and-periodic-table",
            grade: 11,
            description:
              "The periodic law, periodic table trends, classification of elements and their properties.",
          },
          {
            name: "Chemical Bonding and Shapes of Molecules",
            slug: "chemical-bonding-and-shapes-of-molecules",
            grade: 11,
            description:
              "Ionic, covalent and coordinate bonding, VSEPR theory, hybridisation and molecular polarity.",
          },
          {
            name: "Oxidation and Reduction",
            slug: "oxidation-and-reduction",
            grade: 11,
            description:
              "Oxidation number, redox reactions, balancing, the electrochemical series and redox titrations.",
          },
          {
            name: "States of Matter",
            slug: "states-of-matter",
            grade: 11,
            description:
              "Gas, liquid and solid states, intermolecular forces, and ideal versus real gas behaviour.",
          },
          {
            name: "Chemical Equilibrium",
            slug: "chemical-equilibrium",
            grade: 11,
            description:
              "Dynamic equilibrium, Le Chatelier's principle, the equilibrium constant and its applications.",
          },
          {
            name: "Volumetric Analysis",
            slug: "volumetric-analysis",
            grade: 12,
            description:
              "Acid-base titrations, volumetric calculations, indicators and standard solutions.",
          },
          {
            name: "Ionic Equilibrium",
            slug: "ionic-equilibrium",
            grade: 12,
            description:
              "pH, buffers, hydrolysis, the solubility product and the common ion effect.",
          },
          {
            name: "Chemical Kinetics",
            slug: "chemical-kinetics",
            grade: 12,
            description:
              "Rate of reaction, rate laws, order and molecularity, activation energy and temperature dependence.",
          },
          {
            name: "Thermodynamics",
            slug: "thermodynamics",
            grade: 12,
            description:
              "Enthalpy, entropy, Gibbs free energy, Hess's law and the spontaneity of reactions.",
          },
          {
            name: "Electrochemistry",
            slug: "electrochemistry",
            grade: 12,
            description:
              "Electrochemical cells, the Nernst equation, conductance, electrolysis and Faraday's laws.",
          },
        ],
      },

      organicChemistry: {
        name: "Organic Chemistry",
        slug: "organic-chemistry",
        description:
          "Structure, nomenclature and reactions of carbon compounds, grouped by functional group.",

        chapters: [
          {
            name: "Fundamentals of Organic Chemistry",
            slug: "fundamentals-of-organic-chemistry",
            grade: 11,
            description:
              "Nomenclature, isomerism, electronic effects, reaction intermediates and mechanisms.",
          },
          {
            name: "Hydrocarbons",
            slug: "hydrocarbons",
            grade: 11,
            description:
              "Alkanes, alkenes, alkynes and aromatic hydrocarbons: preparation, properties and reactions.",
          },
          {
            name: "Haloalkanes",
            slug: "haloalkanes",
            grade: 12,
            description:
              "Structure, nomenclature, preparation, nucleophilic substitution and elimination reactions.",
          },
          {
            name: "Haloarenes",
            slug: "haloarenes",
            grade: 12,
            description:
              "Structure and reactions of haloarenes, the effect of substituents and nucleophilic aromatic substitution.",
          },
          {
            name: "Alcohols",
            slug: "alcohols",
            grade: 12,
            description:
              "Classification, preparation, properties and reactions of alcohols.",
          },
          {
            name: "Phenols",
            slug: "phenols",
            grade: 12,
            description:
              "Acidity, preparation, electrophilic substitution and reactions of phenols.",
          },
          {
            name: "Ethers",
            slug: "ethers",
            grade: 12,
            description:
              "Preparation, cleavage, Williamson synthesis and the reactions of ethers.",
          },
          {
            name: "Aldehydes and Ketones",
            slug: "aldehydes-and-ketones",
            grade: 12,
            description:
              "Nucleophilic addition, aldol, Cannizzaro and other reactions of aldehydes and ketones.",
          },
          {
            name: "Carboxylic Acid and Its Derivatives",
            slug: "carboxylic-acid-and-its-derivatives",
            grade: 12,
            description:
              "Acidity, preparation and reactions of carboxylic acids and their acid chlorides, esters and amides.",
          },
          {
            name: "Nitro Compounds",
            slug: "nitro-compounds",
            grade: 12,
            description:
              "Preparation, properties, reduction and reactions of nitro compounds.",
          },
          {
            name: "Amines",
            slug: "amines",
            grade: 12,
            description:
              "Classification, basicity, preparation, diazotisation and reactions of amines.",
          },
          {
            name: "Organometallic Compounds",
            slug: "organometallic-compounds",
            grade: 12,
            description:
              "Grignard reagents, organolithium and other organometallic compounds and their reactions.",
          },
        ],
      },

      inorganicChemistry: {
        name: "Inorganic Chemistry",
        slug: "inorganic-chemistry",
        description:
          "Chemistry of elements and their compounds, arranged by element families and metallurgy.",
        chapters: [
          {
            name: "Nitrogen and Its Compounds",
            slug: "nitrogen-and-its-compounds",
            description:
              "Nitrogen, ammonia, nitric acid, the oxides of nitrogen, nitrogen fixation and cyanides.",
          },
          {
            name: "Halogens and Halogen Acids",
            slug: "halogens-and-halogen-acids",
            description:
              "Properties of halogens, hydrogen halides, interhalogens and the oxoacids of chlorine.",
          },
          {
            name: "Carbon and Its Compounds",
            slug: "carbon-and-its-compounds",
            description:
              "Allotropes of carbon, carbon monoxide, carbon dioxide, carbonates and carbonic acid.",
          },
          {
            name: "Oxygen and Oxides",
            slug: "oxygen-and-oxides",
            description:
              "Allotropes of oxygen, ozone, classification of oxides and peroxides.",
          },
          {
            name: "Hydrogen",
            slug: "hydrogen",
            description:
              "Isotopes of hydrogen, preparation and properties of hydrogen, hydrogen peroxide and water.",
          },
          {
            name: "Metallurgical Principles",
            slug: "metallurgical-principles",
            description:
              "Concentration, extraction and refining of metals, thermodynamics and the Ellingham diagram.",
          },
          {
            name: "Transition Metals",
            slug: "transition-metals",
            description:
              "General and physical properties of transition metals, complexes, catalysis and colour.",
          },
          {
            name: "Alkali Metals and Alkaline Earth Metals",
            slug: "alkali-metals-and-alkaline-earth-metals",
            description:
              "General properties, reactions, compounds and the anomalous behaviour of groups 1 and 2.",
          },
          {
            name: "Copper and Its Compounds",
            slug: "copper-and-its-compounds",
            description:
              "Metallurgy, oxidation states, important compounds and reactions of copper.",
          },
          {
            name: "Zinc and Its Compounds",
            slug: "zinc-and-its-compounds",
            description:
              "Metallurgy, important compounds and reactions of zinc.",
          },
          {
            name: "Mercury and Its Compounds",
            slug: "mercury-and-its-compounds",
            description:
              "Metallurgy, oxidation states and the important compounds of mercury.",
          },
          {
            name: "Iron and Its Compounds",
            slug: "iron-and-its-compounds",
            description:
              "Metallurgy, oxidation states, important compounds and industrial iron chemistry.",
          },
          {
            name: "Silver and Its Compounds",
            slug: "silver-and-its-compounds",
            description:
              "Metallurgy, properties and the important compounds of silver.",
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
        description:
          "Foundations: sets, propositional logic, the real number system, relations and functions.",
        chapters: [
          {
            name: "Set and Logic",
            slug: "set-and-logic",
            description:
              "Set operations, Venn diagrams, propositions, connectives and truth tables.",
          },
          {
            name: "Real Number System",
            slug: "real-number-system",
            description:
              "Real numbers, rational and irrational numbers, surds, exponents and logarithms.",
          },
          {
            name: "Relation and Function",
            slug: "relation-and-function",
            description:
              "Relations, functions, types of functions, inverses and their graphs.",
          },
        ],
      },

      algebra: {
        name: "Algebra",
        slug: "algebra",
        description:
          "Algebraic structures and techniques: complex numbers, equations, series, matrices and counting.",
        chapters: [
          {
            name: "Complex Numbers",
            slug: "complex-numbers",
            description:
              "Algebra of complex numbers, modulus, argument, De Moivre's theorem and roots of unity.",
          },
          {
            name: "Polynomial Equations",
            slug: "polynomial-equations",
            description:
              "Polynomial equations, their roots, Vieta's formulae, and the remainder and factor theorems.",
          },
          {
            name: "Sequence and Series",
            slug: "sequence-and-series",
            description:
              "Arithmetic and geometric progressions, special series and summation techniques.",
          },
          {
            name: "Matrices and Determinants",
            slug: "matrices-and-determinants",
            description:
              "Matrix algebra, determinants, the inverse and adjoint, and matrix equations.",
          },
          {
            name: "System of Linear Equations",
            slug: "system-of-linear-equations",
            description:
              "Solving systems of linear equations, consistency of solutions and Cramer's rule.",
          },
          {
            name: "Binomial Expansion",
            slug: "binomial-expansion",
            description:
              "The binomial theorem, general term, middle term and its applications.",
          },
          {
            name: "Exponential and Logarithmic Series",
            slug: "exponential-and-logarithmic-series",
            description:
              "Series expansion of exponential and logarithmic functions and their applications.",
          },
          {
            name: "Permutation and Combination",
            slug: "permutation-and-combination",
            description:
              "Permutations, combinations, circular arrangements and the pigeonhole principle.",
          },
        ],
      },

      calculus: {
        name: "Calculus",
        slug: "calculus",
        description:
          "Limits, continuity, differentiation, integration and their applications.",
        chapters: [
          {
            name: "Limit and Continuity",
            slug: "limit-and-continuity",
            description:
              "Limits, indeterminate forms, continuity and the intermediate value theorem.",
          },
          {
            name: "Differentiation or Derivatives",
            slug: "differentiation-or-derivatives",
            description:
              "Derivative rules, implicit and logarithmic differentiation, and higher derivatives.",
          },
          {
            name: "Antiderivative",
            slug: "antiderivative",
            description:
              "Indefinite integration, standard integrals, substitution and integration by parts.",
          },
          {
            name: "Definite Integrals",
            slug: "definite-integrals",
            description:
              "Definite integrals, their properties, the fundamental theorem of calculus and limits of sums.",
          },
          {
            name: "Application of Derivative",
            slug: "application-of-derivative",
            description:
              "Rate of change, monotonicity, maxima and minima, and tangents and normals.",
          },
          {
            name: "Application of Antiderivatives",
            slug: "application-of-antiderivatives",
            description:
              "Areas under curves, volumes of solids of revolution and applications to differential equations.",
          },
          {
            name: "Differential Equations",
            slug: "differential-equations",
            description:
              "Order and degree, formation of differential equations and their solution methods.",
          },
        ],
      },

      vectors: {
        name: "Vectors",
        slug: "vectors",
        description:
          "Vector algebra, vector products and their geometric applications.",
        chapters: [
          {
            name: "Vectors and Vector Algebra",
            slug: "vectors-and-vector-algebra",
            description:
              "Vector representation, the dot product, section formula and applications in geometry.",
          },
          {
            name: "Vector Products",
            slug: "vector-products",
            description:
              "Cross product, scalar triple product, vector triple product and their geometric meaning.",
          },
        ],
      },

      probabilityAndStatistics: {
        name: "Probability And Statistics",
        slug: "probability-and-statistics",
        description:
          "Descriptive statistics and probability theory, including distributions and expectation.",

        chapters: [
          {
            name: "Statistics",
            slug: "statistics",
            description:
              "Measures of central tendency, dispersion, quartiles and standard deviation.",
          },
          {
            name: "Probability",
            slug: "probability",
            description:
              "Classical and axiomatic probability, conditional probability, Bayes' theorem and distributions.",
          },
        ],
      },

      coordinateGeometry: {
        name: "Coordinate Geometry",
        slug: "coordinate-geometry",
        description:
          "Geometry using coordinates: lines, conics and geometry in three dimensions.",
        chapters: [
          {
            name: "Straight Lines",
            slug: "straight-lines",
            description:
              "Slope, equations, angle between lines, distance and family of lines.",
          },
          {
            name: "Pair of Lines",
            slug: "pair-of-lines",
            description:
              "The combined equation of two lines, the angle between a pair of lines and angle bisectors.",
          },
          {
            name: "Circles",
            slug: "circles",
            description:
              "Circle equations, tangents, the chord of contact, pole and the radical axis.",
          },
          {
            name: "Parabola",
            slug: "parabola",
            description:
              "The standard parabola, focus, directrix, tangents and normals.",
          },
          {
            name: "Ellipse",
            slug: "ellipse",
            description:
              "The standard ellipse, foci, eccentricity and the auxiliary circle.",
          },
          {
            name: "Hyperbola",
            slug: "hyperbola",
            description:
              "The standard hyperbola, asymptotes, the conjugate hyperbola and eccentricity.",
          },
          {
            name: "Coordinate in Space",
            slug: "coordinate-in-space",
            description:
              "Coordinates in 3D, distance, section formula and equations of lines.",
          },
          {
            name: "Plane",
            slug: "plane",
            description:
              "Equations of planes, the angle between planes and conditions for coplanarity.",
          },
        ],
      },

      trigonometry: {
        name: "Trigonometry",
        slug: "trigonometry",
        description:
          "Trigonometric equations, inverse circular functions and triangle properties.",
        chapters: [
          {
            name: "Trigonometric Equations and General Values",
            slug: "trigonometric-equations-and-general-values",
            description:
              "Trigonometric equations, principal and general values, and families of solutions.",
          },
          {
            name: "Inverse Circular Function",
            slug: "inverse-circular-function",
            description:
              "Inverse trigonometric functions, their domains, ranges and identities.",
          },
          {
            name: "Properties of Triangle",
            slug: "properties-of-triangle",
            description:
              "Sine, cosine and projection rules, the circumcircle, incircle and triangle geometry.",
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
        description:
          "English grammar, syntax and vocabulary: sentence structure, verbs, clauses and usage.",
        chapters: [
          {
            name: "Conditional Sentences",
            slug: "conditional-sentences",
            description:
              "Zero, first, second and third conditionals and mixed conditional sentences.",
          },
          {
            name: "Causative Verbs",
            slug: "causative-verbs",
            description:
              "Causative verbs such as make, let, have and get, and their sentence patterns.",
          },
          {
            name: "Kinds of Sentences",
            slug: "kinds-of-sentences",
            description:
              "Declarative, interrogative, imperative, exclamatory and optative sentences.",
          },
          {
            name: "Sentences",
            slug: "sentences",
            description:
              "Sentence structure, subject and predicate, phrase and clause, and sentence types.",
          },
          {
            name: "Tenses and Aspects",
            slug: "tenses-and-aspects",
            description:
              "Verb tenses, continuous and perfect aspects, and their usage in context.",
          },
          {
            name: "Use of Prepositions",
            slug: "use-of-prepositions",
            description:
              "Prepositions of time, place and direction, and correct preposition usage.",
          },
          {
            name: "Subject-Verb Agreement",
            slug: "subject-verb-agreement",
            description:
              "Rules of subject-verb agreement including collective nouns and indefinite pronouns.",
          },
          {
            name: "Infinitives and Gerunds",
            slug: "infinitives-and-gerunds",
            description:
              "Gerunds and infinitives as subjects and objects, and verb plus infinitive/gerund patterns.",
          },
          {
            name: "Relative Pronouns",
            slug: "relative-pronouns",
            description:
              "Relative pronouns, relative clauses and restrictive versus non-restrictive clauses.",
          },
          {
            name: "Sound and Word Stress",
            slug: "sound-and-word-stress",
            description:
              "Word stress patterns, stress placement and common stress rules.",
          },
          {
            name: "Direct and Indirect Speech",
            slug: "direct-and-indirect-speech",
            description:
              "Narration rules, and tense and pronoun changes in direct and indirect speech.",
          },
          {
            name: "Active and Passive Voice",
            slug: "active-and-passive-voice",
            description:
              "Voice change rules for all tenses and modal verbs in active and passive forms.",
          },
          {
            name: "Use of Articles",
            slug: "use-of-articles",
            description:
              "Definite and indefinite articles, the zero article and article usage rules.",
          },
          {
            name: "Synonyms and Antonyms",
            slug: "synonyms-and-antonyms",
            description:
              "Synonyms, antonyms, word meanings and vocabulary in context.",
          },
          {
            name: "Punctuation",
            slug: "punctuation",
            description:
              "Punctuation marks, capitalisation and standard punctuation conventions.",
          },
          {
            name: "Phonemes",
            slug: "phonemes",
            description:
              "Phonetic transcription, phonemes, minimal pairs and pronunciation of consonants and vowels.",
          },
        ],
      },

      comprehension: {
        name: "Comprehension",
        slug: "comprehension",
        description:
          "Reading comprehension: analysing passages, deriving answers and drawing inferences.",
        chapters: [
          {
            name: "Reading Comprehension",
            slug: "reading-comprehension",
            description:
              "Understanding passages, identifying main ideas, and answering inference and detail questions.",
          },
        ],
      },
    },
  },
} as const;
