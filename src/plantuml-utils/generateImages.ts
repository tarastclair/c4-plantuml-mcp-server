/**
 * AI ASSISTANCE DISCLAIMER
 * Parts of this code were written with the assistance of an AI language model.
 * While efforts have been made to ensure quality and correctness,
 * please review thoroughly before implementing in production environments.
 */

import axios from 'axios';
import { encode as encodePlantUMLWithDeflate } from 'plantuml-encoder';
import { savePngFile } from '../filesystem-utils.js';

/**
 * Encodes PlantUML diagram text for use with PlantUML server
 * Uses DEFLATE compression as required by PlantUML server
 * @param puml Raw PlantUML diagram text
 * @returns Encoded string safe for URLs
 */
export const encodePlantUML = (puml: string): string => {
  return encodePlantUMLWithDeflate(puml);
};

/**
 * Sleep function for retry mechanism
 * @param ms Milliseconds to sleep
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Generates a PNG diagram from PlantUML markup by calling the public PlantUML server
 * Implements robust retry logic with exponential backoff for intermittent server issues
 * 
 * @param puml PlantUML markup to render
 * @param pngPath Path where PNG file should be saved
 * @param maxRetries Maximum number of retry attempts (default: 5)
 * @param initialDelay Initial delay in ms between retries (default: 1s)
 * @returns PNG data as a base64 string
 */
export const generateAndSaveDiagramImage = async (
  puml: string,
  pngPath: string,
  maxRetries = 5,
  initialDelay = 1000
): Promise<string> => {
  // Encode the PlantUML for the URL
  const encoded = encodePlantUML(puml);
  let lastError: Error | null = null;
  
  // Try multiple times with exponential backoff
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // If this isn't the first attempt, log that we're retrying
      if (attempt > 0) {
        console.error(`Retrying PlantUML diagram generation (attempt ${attempt + 1} of ${maxRetries + 1})`);
      }
      
      // Make the request to the public PlantUML server
      const response = await axios.get(`https://www.plantuml.com/plantuml/png/${encoded}`, {
        responseType: 'arraybuffer',
        timeout: 15000 // 15 second timeout to avoid hanging on slow responses
      });

      // Convert the binary response to base64
      const pngData = Buffer.from(response.data).toString('base64');

      // Save the PNG file using our utility
      await savePngFile(pngPath, pngData);
      
      return pngData;
    } catch (error: any) {
      lastError = error;
      
      // Prepare a descriptive error message
      let errorMessage = '';
      
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const statusText = error.response?.statusText || '';
        
        errorMessage = `PlantUML Server Error (attempt ${attempt + 1}/${maxRetries + 1}): HTTP ${status} ${statusText}`;
        
        // We'll retry ALL errors since 400s and 509s are often temporary with the public server
        // Only skip retrying on client errors that won't change with retries
        const permanentClientError = status === 401 
          || status === 403;
        
        // If this is our last attempt OR it's a permanent client error, throw
        if (attempt >= maxRetries || permanentClientError) {
          console.error(errorMessage);
          throw new Error(errorMessage);
        }
      } else {
        // For non-Axios errors (network issues, etc.)
        errorMessage = `PlantUML generation error (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message}`;
        
        // If this is our last attempt, throw
        if (attempt >= maxRetries) {
          console.error(errorMessage);
          throw new Error(`Failed to generate diagram: ${error.message}`);
        }
      }
      
      // Log the error but continue with retry
      console.error(errorMessage);
      
      // Calculate backoff delay with jitter to avoid thundering herd
      const delay = initialDelay * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5);
      console.error(`Waiting ${Math.round(delay)}ms before retry...`);
      await sleep(delay);
    }
  }
  
  // This should never happen due to the error handling above, but TypeScript wants it
  throw lastError || new Error('Failed to generate diagram after retries');
};