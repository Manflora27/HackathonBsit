/**
 * MATATAG quarter map: what each grade actually studies each quarter, per the DepEd guides.
 * Structure and topic titles were extracted from the official PDFs; the wording here is ours,
 * and no competency text is copied. Verified against:
 *   - MATATAG Mathematics (Grades 1-10), August 2023
 *     https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf
 *   - MATATAG Science (Grades 3-10), August 2023
 *     https://www.deped.gov.ph/wp-content/uploads/MATATAG-Science-CG-Grade-4-and-7.pdf
 * Research notes: docs/research/deped-curriculum-sources.md
 */

export type MatatagCode = "NA" | "MG" | "DP";

/** One content domain inside a quarter, with the topics the guide lists for it. */
export interface MatatagDomain { code: MatatagCode; name: string; topics: string[] }

/** Science quarters are themed; Math quarters mix content domains. */
export interface MatatagScienceQuarter { theme: string; topics: string[] }

export const MATATAG_MATH: Record<number, Record<number, MatatagDomain[]>> = {
  1: {
    1: [
      { code: "MG", name: "Measurement and Geometry", topics: [
        "simple 2-dimensional shapes and their features",
      ] },
      { code: "NA", name: "Number and Algebra", topics: [
        "whole numbers up to 100",
        "ordinal numbers up to 10th",
        "addition of numbers with sums up to 20",
      ] },
    ],
    2: [
      { code: "MG", name: "Measurement and Geometry", topics: [
        "measurement of length and distance using non-standard units",
      ] },
      { code: "NA", name: "Number and Algebra", topics: [
        "place value in any 2-digit number",
        "addition of numbers, with sums up to 100",
      ] },
    ],
    3: [
      { code: "DP", name: "Data and Probability", topics: [
        "a pictograph without a scale for the representation of data",
      ] },
      { code: "NA", name: "Number and Algebra", topics: [
        "subtraction of numbers where both numbers are less than 100",
        "repeating patterns",
      ] },
    ],
    4: [
      { code: "NA", name: "Number and Algebra", topics: [
        "fractions",
        "the denominations and values of Philippine coins and bills up to ₱100",
        "addition of money where the sum is up to ₱100 and subtraction of money where both amounts are less than ₱100",
      ] },
      { code: "MG", name: "Measurement and Geometry", topics: [
        "the movement of objects in half turn or quarter turn, in clockwise or counter clockwise direction",
        "time measured in hours, half hours, quarter hours, days, weeks, months, and years",
      ] },
    ],
  },
  2: {
    1: [
      { code: "MG", name: "Measurement and Geometry", topics: [
        "circles, half circles, quarter circles and composite figures made up of squares, rectangles, triangles, circles, half circles, and quarter circles",
        "one step slides and flips of basic shapes and figures",
      ] },
      { code: "NA", name: "Number and Algebra", topics: [
        "whole numbers up to 1000",
        "ordinal numbers up to 20th",
        "addition of numbers with sums up to 1000",
      ] },
    ],
    2: [
      { code: "NA", name: "Number and Algebra", topics: [
        "the denominations and values of Philippine coins and bills up to ₱1000, and the addition of amounts of money with sums up to ₱1000",
        "subtraction of numbers where both numbers are less than 1000",
        "increasing patterns and decreasing patterns",
      ] },
      { code: "MG", name: "Measurement and Geometry", topics: [
        "measurement, comparison, and estimation of length and distance using appropriate tools and units",
      ] },
    ],
    3: [
      { code: "DP", name: "Data and Probability", topics: [
        "a pictograph with a scale for the representation of data",
      ] },
      { code: "NA", name: "Number and Algebra", topics: [
        "multiplication and division of whole numbers using the 2, 3, 4, 5, and 10 multiplication tables",
        "odd and even numbers",
      ] },
    ],
    4: [
      { code: "NA", name: "Number and Algebra", topics: [
        "unit fractions and similar fractions with denominators 2, 3, 4, 5, 6, and 8",
      ] },
      { code: "MG", name: "Measurement and Geometry", topics: [
        "duration of time, elapsed time, and telling and writing time in hours and minutes (using a.m",
        "straight and curved lines, and flat and curved surfaces",
        "the perimeter of triangles, squares, and rectangles",
      ] },
    ],
  },
  3: {
    1: [
      { code: "MG", name: "Measurement and Geometry", topics: [
        "areas of squares and rectangles",
        "points, lines, line segments, and rays",
        "parallel, perpendicular, and intersecting lines",
      ] },
      { code: "NA", name: "Number and Algebra", topics: [
        "whole numbers up to 10 000",
        "ordinal numbers up to 100th",
      ] },
    ],
    2: [
      { code: "MG", name: "Measurement and Geometry", topics: [
        "measures of mass and capacity",
      ] },
      { code: "NA", name: "Number and Algebra", topics: [
        "addition and subtraction of numbers of up to 4 digits and money up to ₱10 000",
      ] },
    ],
    3: [
      { code: "DP", name: "Data and Probability", topics: [
        "data presented in tables and single bar graphs",
        "outcomes from experiments and real-life situations",
      ] },
      { code: "NA", name: "Number and Algebra", topics: [
        "multiplication using 6, 7, 8, and 9 multiplication tables",
        "properties of multiplication",
        "multiplication of numbers with and without regrouping",
        "estimation of products of two numbers by first rounding to the nearest multiple of 10",
        "determination of missing terms contained in repeating and increasing patterns, and repeating and decreasing patterns",
        "generation of repeating and increasing patterns, and repeating and decreasing patterns",
      ] },
    ],
    4: [
      { code: "NA", name: "Number and Algebra", topics: [
        "division using the 6, 7, 8, and 9 multiplication tables",
        "division of 2- to 4-digit numbers",
        "estimation of quotients by first rounding the divisor and dividend to the nearest multiple of 10",
        "addition and subtraction of similar fractions",
      ] },
      { code: "MG", name: "Measurement and Geometry", topics: [
        "line symmetry",
        "resulting figure after a translation",
      ] },
    ],
  },
  4: {
    1: [
      { code: "MG", name: "Measurement and Geometry", topics: [
        "measures of angles",
        "properties of triangles and quadrilaterals",
        "perimeter of quadrilaterals, and composite figures composed of triangles and quadrilaterals",
      ] },
      { code: "NA", name: "Number and Algebra", topics: [
        "whole numbers up to 1 000 000",
        "addition of numbers with sums up to 1 000 000 and subtraction of numbers where both numbers are less than 1 000 000",
      ] },
    ],
    2: [
      { code: "NA", name: "Number and Algebra", topics: [
        "multiplication of whole numbers with products up to 1 000 000, division of up to 4-digit numbers by up to 2-digit numbers, and the MDAS rules",
      ] },
      { code: "MG", name: "Measurement and Geometry", topics: [
        "conversion of units of length, mass, capacity, and time",
      ] },
    ],
    3: [
      { code: "NA", name: "Number and Algebra", topics: [
        "dissimilar and equivalent fractions",
        "factors and multiples of numbers up to 100",
        "addition and subtraction of dissimilar fractions",
      ] },
      { code: "MG", name: "Measurement and Geometry", topics: [
        "symmetric figures with respect to a line",
        "resulting images after applying reflection with respect to a line",
      ] },
    ],
    4: [
      { code: "DP", name: "Data and Probability", topics: [
        "presentation and interpretation of data in tabular form and in a single line graph",
      ] },
      { code: "NA", name: "Number and Algebra", topics: [
        "simple patterns",
        "number sentences",
        "decimal numbers and their relationship to fractions",
      ] },
    ],
  },
  5: {
    1: [
      { code: "MG", name: "Measurement and Geometry", topics: [
        "12- and 24-hour time, and world time zones",
        "area of a parallelogram, triangle, and trapezoid",
      ] },
      { code: "NA", name: "Number and Algebra", topics: [
        "the GMDAS rules for operations with numbers",
        "multiplication of fractions",
      ] },
    ],
    2: [
      { code: "NA", name: "Number and Algebra", topics: [
        "division of fractions",
        "decimal numbers with decimal parts up to ten thousandths",
        "addition and subtraction of decimal numbers",
        "divisibility rules",
        "prime and composite numbers",
      ] },
    ],
    3: [
      { code: "DP", name: "Data and Probability", topics: [
        "double bar graphs and double line graphs",
        "theoretical probability",
      ] },
      { code: "NA", name: "Number and Algebra", topics: [
        "multiplication and division of decimal numbers",
      ] },
    ],
    4: [
      { code: "NA", name: "Number and Algebra", topics: [
        "GMDAS rules when performing three or more operations with fractions and decimals",
      ] },
      { code: "MG", name: "Measurement and Geometry", topics: [
        "prisms and pyramids",
        "surface area of solid figures",
        "cubes and rectangular prisms",
        "resulting image after rotation",
      ] },
    ],
  },
  6: {
    1: [
      { code: "MG", name: "Measurement and Geometry", topics: [
        "tessellation of shapes",
        "translation, reflection and rotation with shapes",
      ] },
      { code: "NA", name: "Number and Algebra", topics: [
        "the four operations with decimals",
        "the four operations with different combinations of fractions, whole numbers, and mixed numbers",
      ] },
    ],
    2: [
      { code: "NA", name: "Number and Algebra", topics: [
        "ratio and proportion",
        "percentages, and their relationships with fractions and decimals",
        "exponential form, including calculation using the GEMDAS rules",
      ] },
    ],
    3: [
      { code: "MG", name: "Measurement and Geometry", topics: [
        "units of volume and capacity",
        "volume of cubes and rectangular prisms",
        "perimeter and area of triangles, parallelograms, trapezoids, and composite figures composed of triangles, squares, and rectangles",
        "parts of a circle, including circumference",
      ] },
    ],
    4: [
      { code: "MG", name: "Measurement and Geometry", topics: [
        "area of a circle",
        "composite figures composed of any two or more of: triangle, square, rectangle, circle, semi-circle",
      ] },
      { code: "DP", name: "Data and Probability", topics: [
        "pie graphs",
      ] },
      { code: "NA", name: "Number and Algebra", topics: [
        "common factors, greatest common factors, common multiples, and least common multiples",
      ] },
    ],
  },
  7: {
    1: [
      { code: "MG", name: "Measurement and Geometry", topics: [
        "regular and irregular polygons and their features/properties",
        "determination of measures of angles and number of sides of polygons",
      ] },
      { code: "NA", name: "Number and Algebra", topics: [
        "application of percentages",
        "use of rates",
        "rational numbers",
      ] },
    ],
    2: [
      { code: "NA", name: "Number and Algebra", topics: [
        "square roots of perfect squares, cube roots of perfect cubes, and irrational numbers",
        "sets and subsets, and the union and intersection of sets using Venn diagrams",
        "subset of real numbers",
      ] },
      { code: "MG", name: "Measurement and Geometry", topics: [
        "conversion of units of measure",
        "volume of square and rectangular pyramids, and cylinders",
      ] },
    ],
    3: [
      { code: "DP", name: "Data and Probability", topics: [
        "data collection and sampling techniques, and the presentation of data in appropriate tables and graphs",
        "interpretation of statistical graphs",
      ] },
      { code: "NA", name: "Number and Algebra", topics: [
        "the set of integers, and comparing and ordering integers",
        "the four operations with integers",
        "simplification of numerical expressions involving integers",
        "absolute value of an integer",
      ] },
    ],
    4: [
      { code: "NA", name: "Number and Algebra", topics: [
        "the solution of simple equations",
        "the evaluation of algebraic expressions following substitution",
        "the rearrangement of a formula to make a different variable the subject of the formula",
        "operations using scientific notation",
      ] },
      { code: "DP", name: "Data and Probability", topics: [
        "outcomes from experiments",
      ] },
    ],
  },
  8: {
    1: [
      { code: "DP", name: "Data and Probability", topics: [
        "measures of central tendency of ungrouped data",
      ] },
      { code: "NA", name: "Number and Algebra", topics: [
        "algebraic expressions and operations with monomials, binomials, and multinomials",
        "rational algebraic expressions and equations",
        "rules for obtaining terms in sequences",
      ] },
    ],
    2: [
      { code: "NA", name: "Number and Algebra", topics: [
        "plotting points, and finding distance and the midpoint of line segments on the Cartesian coordinate plane",
        "earning money, profit and loss, ‘best buys', buying on terms",
      ] },
      { code: "MG", name: "Measurement and Geometry", topics: [
        "volume of pyramids (other than square and rectangular pyramids), cones, and spheres",
        "the Pythagorean Theorem",
        "triangle inequality theorems",
      ] },
    ],
    3: [
      { code: "NA", name: "Number and Algebra", topics: [
        "linear equations in one variable",
        "linear inequalities in one variable and their graphs",
        "linear equations in two variables and their graphs",
        "systems of linear equations in two variables",
        "linear inequalities in two variables",
      ] },
    ],
    4: [
      { code: "DP", name: "Data and Probability", topics: [
        "measures of variability for ungrouped data",
        "interpretation and analysis of graphs from primary and secondary data",
        "experimental and theoretical probability",
        "the Fundamental Counting Principle",
      ] },
    ],
  },
  9: {
    1: [
      { code: "MG", name: "Measurement and Geometry", topics: [
        "simple geometric concepts and notations",
        "perpendicular and parallel lines, and angles formed by parallel lines cut by a transversal",
      ] },
      { code: "NA", name: "Number and Algebra", topics: [
        "relations and functions",
        "graphs of linear functions, and the identification of domain and range, slope, intercepts, and zeros",
      ] },
    ],
    2: [
      { code: "MG", name: "Measurement and Geometry", topics: [
        "parallelism and perpendicularity of lines",
        "different quadrilaterals and their properties",
        "congruence of triangles",
        "congruence proofs",
      ] },
    ],
    3: [
      { code: "NA", name: "Number and Algebra", topics: [
        "quadratic equations and graphs of quadratic functions",
        "the solution of quadratic equations",
        "direct and inverse variation",
      ] },
      { code: "MG", name: "Measurement and Geometry", topics: [
        "similarity of polygons",
        "special triangles",
      ] },
    ],
    4: [
      { code: "MG", name: "Measurement and Geometry", topics: [
        "triangle theorems and triangle inequality theorems",
        "the trigonometric ratios and their application",
      ] },
      { code: "DP", name: "Data and Probability", topics: [
        "interpretation and analysis of data to assess whether the data may be misleading",
        "probabilities of simple and compound events",
      ] },
    ],
  },
  10: {
    1: [
      { code: "MG", name: "Measurement and Geometry", topics: [
        "the laws of sines and the laws of cosines",
        "translations, reflections, and rotations, in the Cartesian plane",
      ] },
      { code: "NA", name: "Number and Algebra", topics: [
        "quadratic inequalities in one variable and in two variables",
        "absolute value equations and inequalities in one variable and their graphs",
      ] },
    ],
    2: [
      { code: "DP", name: "Data and Probability", topics: [
        "box-and-whisker plots, and cumulative frequency histograms and polygons",
        "quartiles, deciles, and percentiles; interquartile range, and outliers",
      ] },
      { code: "NA", name: "Number and Algebra", topics: [
        "radical expressions",
        "the roots of a quadratic equation",
        "quadratic functions",
        "equations reducible to quadratic equations",
      ] },
    ],
    3: [
      { code: "NA", name: "Number and Algebra", topics: [
        "equation of a circle and the graph of a circle",
      ] },
      { code: "DP", name: "Data and Probability", topics: [
        "evaluation of statistical reports",
        "union and intersection of events, dependent and independent events, and complementary events",
      ] },
    ],
    4: [
      { code: "NA", name: "Number and Algebra", topics: [
        "simple interest, compound interest, and depreciation",
      ] },
      { code: "MG", name: "Measurement and Geometry", topics: [
        "central angles; inscribed angles; and angles and lengths formed by intersecting chords, secants, and tangents of a circle",
        "sectors and segments of a circle, and their areas",
      ] },
    ],
  },
};

export const MATATAG_SCIENCE: Record<number, Record<number, MatatagScienceQuarter>> = {
  3: {
    1: { theme: "Materials", topics: [
      "Science in our daily life",
      "Science processes",
      "Materials and their uses",
    ] },
    2: { theme: "Living Things", topics: [
      "Guided science activities using process skills",
      "Living and non-living things",
      "Characteristics of living things",
      "Basic needs of living things",
    ] },
    3: { theme: "Force, Motion, and Energy", topics: [
      "Exploring and Questioning",
      "Moving objects",
      "Light and sound",
    ] },
    4: { theme: "Earth and Space", topics: [
      "The Non-Living environment",
      "Patterns in the weather",
      "Celestial objects",
    ] },
  },
  4: {
    1: { theme: "Materials", topics: [
      "Science inventions",
      "Materials and their uses",
      "Gathering scientific information",
    ] },
    2: { theme: "Living Things", topics: [
      "Systems in plants and animals",
      "Plants and animals and their habitats",
      "Life cycles of animals",
      "Animals and the food they eat",
      "Food chains",
    ] },
    3: { theme: "Force, Motion, and Energy", topics: [
      "Forces and movement",
      "Observing, measuring, and predicting",
      "Magnets",
      "Sound, light, and heat energy",
    ] },
    4: { theme: "Earth and Space", topics: [
      "Soils",
      "Characteristics of weather",
      "Characteristics of the Sun",
    ] },
  },
  5: {
    1: { theme: "Materials", topics: [
      "Matter in daily life",
      "Matter and the three states",
      "Scientific investigation",
    ] },
    2: { theme: "Living Things", topics: [
      "Body systems in animals",
      "Plants, animals, and microorganisms",
      "Life cycles of living things",
      "Specialized structures in plants",
    ] },
    3: { theme: "Force, Motion, and Energy", topics: [
      "Contact and non-contact forces",
      "Investigating scientifically",
      "Friction",
      "Gravity",
      "Static electricity",
      "Conductors, insulators, and simple circuits",
    ] },
    4: { theme: "Earth and Space", topics: [
      "Landforms, rocks and minerals",
      "Weathering and erosion",
      "Using models",
      "The Water Cycle",
      "Weather disturbances",
      "The Solar System",
    ] },
  },
  6: {
    1: { theme: "Materials", topics: [
      "Diagrams and flowcharts",
      "Processes of changes of state",
      "Physical and chemical change",
      "Mixtures and separation techniques",
    ] },
    2: { theme: "Living Things", topics: [
      "The circulatory system",
      "Reproduction in plants",
      "Vertebrates and invertebrates",
      "Food webs",
      "Interactions between living things",
      "Biotic and abiotic factors in an ecosystem",
    ] },
    3: { theme: "Force, Motion, and Energy", topics: [
      "Simple machines",
      "Properties of water and sound waves",
      "Longitudinal and Transverse waves",
    ] },
    4: { theme: "Earth and Space", topics: [
      "Volcanic activity and safety",
      "Seasons in the Philippines",
      "Motions of the Earth",
      "Constellations",
      "Understanding stability and change",
    ] },
  },
  7: {
    1: { theme: "Science of Materials", topics: [
      "Use of models",
      "The Particle model and changes of state",
      "Planning, following, and recording scientific investigations",
      "Solutions, solubility, and concentration",
    ] },
    2: { theme: "Life Science", topics: [
      "Science equipment: the compound microscope",
      "Plant and animal cells",
      "Cellular reproduction",
      "Levels of biological organization",
      "Trophic levels and the transfer of energy",
    ] },
    3: { theme: "Force, Motion, and Energy", topics: [
      "Balanced and unbalanced forces",
      "Motion: displacement and velocity",
      "Distance-Time graphs",
      "Identifying and controlling variables",
      "Heat transfer",
    ] },
    4: { theme: "Earth and Space Science", topics: [
      "System models",
      "Earthquakes",
      "The Sun's influence on Earth",
    ] },
  },
  8: {
    1: { theme: "Life Science", topics: [
      "Organ systems working together",
      "Heredity",
      "Taxonomic classification",
      "Photosynthesis, respiration and cycles in nature",
    ] },
    2: { theme: "Science of Materials", topics: [
      "Use of timelines and charts",
      "The Atomic Model",
      "Subatomic particles",
      "Elements and compounds",
      "The Periodic table",
    ] },
    3: { theme: "Earth and Space Science", topics: [
      "Distribution of the continents",
      "Crustal features and interactions",
      "Typhoons",
      "Tides",
    ] },
    4: { theme: "Force, Motion, and Energy", topics: [
      "Acceleration",
      "Distance-time and Velocity-time graphs",
      "Kinetic and Potential energy",
      "Work and energy",
      "Renewable energy",
      "Properties of light",
    ] },
  },
  9: {
    1: { theme: "Force, Motion, and Energy", topics: [
      "Newton's Laws",
      "Force and energy",
      "Electric current",
      "Electrical circuits",
      "Interpreting patterns in data",
      "Electromagnetic waves",
    ] },
    2: { theme: "Earth and Space Science", topics: [
      "Scale, proportion and quantity",
      "Plate boundaries",
      "Structure of the Earth",
      "Geologic time",
      "Origin of the Solar System",
      "Space Technologies",
    ] },
    3: { theme: "Life Science", topics: [
      "DNA replication and mutations",
      "Biodiversity and endangered species",
      "Types of ecosystems in the Philippines",
    ] },
    4: { theme: "Science of Materials", topics: [
      "Valid and reliable investigations",
      "Chemical bonding",
      "Ionic compounds",
      "Covalent compounds",
      "Metallic bonds",
      "Chemical formula",
    ] },
  },
  10: {
    1: { theme: "Earth and Space Science", topics: [
      "Plate Tectonics",
      "Global climate",
      "Global interactions",
      "Global and local Sustainability",
    ] },
    2: { theme: "Force, Motion, and Energy", topics: [
      "Projectile motion",
      "Momentum and Collisions",
      "Large-scale generation and distribution of electricity",
      "Renewable and non-renewable energy",
    ] },
    3: { theme: "Science of Materials", topics: [
      "Chemical reactions",
      "Acids, bases, and salts",
      "Types of chemical reactions",
      "Chemical reactions in the environment",
      "Chemical equations",
      "Rates of reactions",
    ] },
    4: { theme: "Life Science", topics: [
      "Homeostasis",
      "Mechanisms of evolution",
      "Biotechnology",
      "Ecosystem's carrying capacity and population growth",
    ] },
  },
};
