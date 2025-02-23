import { promises as fs } from 'fs';
import path from 'path';
import { encode } from 'plantuml-encoder';
import axios from 'axios';
import { C4Diagram } from './types-and-interfaces.js';

// Read the diagram data from our JSON storage
async function readDiagramData(id: string): Promise<C4Diagram> {
    const data = await fs.readFile(path.join('data', 'diagrams.json'), 'utf8');
    const json = JSON.parse(data);
    const diagram = json.diagrams.find((d: C4Diagram) => d.id === id);
    if (!diagram) {
        throw new Error(`Diagram ${id} not found`);
    }
    return diagram;
}

// Convert our diagram data into PlantUML syntax
function generatePlantUMLFromDiagram(diagram: C4Diagram): string {
    const lines: string[] = [];
    
    // Header
    lines.push('@startuml');
    lines.push('!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml');
    lines.push('HIDE_STEREOTYPE()');
    lines.push('');
    
    // Title and description as a note
    lines.push(`title ${diagram.name}`);
    if (diagram.description) {
        lines.push('');
        lines.push(`note as DiagramDescription`);
        lines.push(diagram.description);
        lines.push('end note');
    }
    lines.push('');

    // Add elements by type
    diagram.elements.forEach(element => {
        const id = element.id.replace(/[^\w]/g, '_');
        const name = element.name;
        const description = element.description;
        
        switch (element.type) {
            case 'system':
                lines.push(`System(${id}, "${name}", "${description}")`);
                break;
            case 'person':
                lines.push(`Person(${id}, "${name}", "${description}")`);
                break;
            case 'external-system':
                lines.push(`System_Ext(${id}, "${name}", "${description}")`);
                break;
        }
    });
    lines.push('');

    // Track processed relationships to prevent duplicates
    const processedRels = new Set<string>();

    // Add relationships, ensuring no duplicates
    diagram.relationships.forEach(rel => {
        const source = diagram.elements.find(e => e.id === rel.sourceId);
        const target = diagram.elements.find(e => e.id === rel.targetId);
        
        if (source && target) {
            const sourceId = source.id.replace(/[^\w]/g, '_');
            const targetId = target.id.replace(/[^\w]/g, '_');
            const techStr = rel.technology ? `, "${rel.technology}"` : '';
            
            // Create a unique key for this relationship
            const relKey = `${sourceId}-${targetId}-${rel.description}`;
            
            // Only add if we haven't seen this relationship before
            if (!processedRels.has(relKey)) {
                processedRels.add(relKey);
                lines.push(`Rel(${sourceId}, ${targetId}, "${rel.description}"${techStr})`);
            }
        }
    });
    lines.push('');

    // Footer
    lines.push('@enduml');

    return lines.join('\n');
}

// Generate PNG and save to file
async function generateAndSavePNG(puml: string, outputPath: string): Promise<void> {
    console.log('Debug - PlantUML Content:');
    console.log(puml);
    
    const encoded = encode(puml);
    console.log('\nDebug - Encoded URL:');
    console.log(encoded);
    
    try {
        const response = await axios.get(`https://www.plantuml.com/plantuml/png/${encoded}`, {
            responseType: 'arraybuffer'
        });

        // Create output directory if it doesn't exist
        const dir = path.dirname(outputPath);
        await fs.mkdir(dir, { recursive: true });

        // Write PNG file
        await fs.writeFile(outputPath, response.data);
        console.log(`\nPNG file written to: ${outputPath}`);
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            console.error('PlantUML Server Error:');
            console.error('Status:', error.response.status);
            console.error('Headers:', error.response.headers);
        }
        throw error;
    }
}

// Main test function
async function main() {
    try {
        // Get our test diagram
        const diagram = await readDiagramData('25ad2b0f-9a22-4403-80fe-a3396fd7a6ed');
        console.log('Found diagram:', diagram.name);

        // Generate PlantUML
        const puml = generatePlantUMLFromDiagram(diagram);

        // Generate and save PNG
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputPath = path.join('output', 'png', `${diagram.id}-${timestamp}.png`);
        await generateAndSavePNG(puml, outputPath);

    } catch (error) {
        console.error('Error in test:', error);
    }
}

main();