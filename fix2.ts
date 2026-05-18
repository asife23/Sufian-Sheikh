import fs from 'fs';
import path from 'path';

const viewsDir = path.join(process.cwd(), 'src', 'views');
const files = fs.readdirSync(viewsDir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
    const filePath = path.join(viewsDir, file);
    let content = fs.readFileSync(filePath, 'utf-8');
    
    if (content.includes('import { db,')) {
        if (!content.match(/import \{.*fastGetDocs.*\}/)) {
            content = content.replace(/import \{ (db[^}]*) \} from '\.\.\/firebase';/, "import { $1, fastGetDocs } from '../firebase';");
            fs.writeFileSync(filePath, content);
        }
    }
}
