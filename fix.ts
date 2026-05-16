import * as fs from 'fs';
import * as path from 'path';

const files = [
  'Batches.tsx',
  'Dues.tsx',
  'Feed.tsx',
  'Medicine.tsx',
  'Mortality.tsx',
  'Sales.tsx'
];

for (const file of files) {
  const filePath = path.join(process.cwd(), 'src/views', file);
  let content = fs.readFileSync(filePath, 'utf-8');

  // Skip if already fixed
  if (content.includes('submitLock.current')) continue;

  if (content.includes("import React, { useState, useEffect }")) {
    content = content.replace("import React, { useState, useEffect }", "import React, { useState, useEffect, useRef }");
  } else if (content.includes("import React, { useState }")) {
     content = content.replace("import React, { useState }", "import React, { useState, useRef }");
  } else {
     content = content.replace("import React, { useState", "import React, { useState, useRef");
  }

  content = content.replace(
    /const \[isSubmitting, setIsSubmitting\] = useState\(false\);/,
    "const [isSubmitting, setIsSubmitting] = useState(false);\n  const submitLock = useRef(false);"
  );

  content = content.replace(
    /if \(!currentUser \|\| !batchId \|\| isSubmitting\) return toast\.error\('ব্যাচ নির্বাচন করুন'\);/,
    "if (!currentUser || !batchId) return toast.error('ব্যাচ নির্বাচন করুন');\n    if (isSubmitting || submitLock.current) return;"
  );
  
  content = content.replace(
    /if \(!currentUser \|\| isSubmitting\) return;/,
    "if (!currentUser) return;\n    if (isSubmitting || submitLock.current) return;"
  );

  content = content.replace(
    /setIsSubmitting\(true\);/,
    "setIsSubmitting(true);\n    submitLock.current = true;"
  );

  content = content.replace(
    /setIsSubmitting\(false\);/g,
    "setIsSubmitting(false);\n      submitLock.current = false;"
  );

  // Partial payment code for dues
  if (file === 'Dues.tsx') {
    content = content.replace(
      "if (!paymentRecordId || !paymentAmount || isSubmitting) return;",
      "if (!paymentRecordId || !paymentAmount || isSubmitting || submitLock.current) return;"
    );
  }

  fs.writeFileSync(filePath, content);
}
