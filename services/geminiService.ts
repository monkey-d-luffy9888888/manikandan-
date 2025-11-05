import { GoogleGenAI, Type } from '@google/genai';
import { Attribute } from '../types';

// Schema for structured JSON output from Gemini
const geminiAttributeSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        attribute: {
          type: Type.STRING,
          description: 'The name of the product attribute (e.g., Color, Size).',
        },
        value: {
          type: Type.STRING,
          description: 'The value of the product attribute (e.g., Red, Large).',
        },
      },
      required: ['attribute', 'value'],
    },
};

const fetchWithGemini = async (productLink: string, apiKey: string, schema?: any, category?: string): Promise<Attribute[]> => {
    let geminiPrompt: string;
    let config: any = {};

    if (schema && category) {
        geminiPrompt = `From the URL provided, extract product attributes based on the specified category and JSON schema.
URL: ${productLink}
Category: ${category}
Only extract the attributes defined in the schema. Adhere strictly to the schema's structure and types.`;
        config = {
            responseMimeType: "application/json",
            responseSchema: schema,
        };
    } else {
        geminiPrompt = `
Analyze the content of the provided URL to identify and extract key product attributes. Focus on technical specifications, physical properties, and essential features.

**Instructions:**
1.  **Extract Core Attributes:** Identify attributes like Color, Size, Material, Dimensions, Weight, Power, Capacity, etc.
2.  **Be Specific:** Capture detailed values. For dimensions, use the format "Height x Width x Depth". For weight, include units (e.g., "5.2 kg").
3.  **Ignore Irrelevant Information:** Do NOT extract information about pricing, shipping, stock availability, customer reviews, or marketing slogans.
4.  **Format Correctly:** Return the data as a JSON array of objects, where each object has an "attribute" key and a "value" key, matching the provided schema.

URL to analyze: ${productLink}
`;
        config = {
            responseMimeType: "application/json",
            responseSchema: geminiAttributeSchema,
        };
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: geminiPrompt,
            config,
        });

        const jsonString = response.text.trim();
        const parsedJson = JSON.parse(jsonString);

        if (Array.isArray(parsedJson)) {
            // If a schema was provided, the API should already validate it.
            // If no schema, we do a basic check.
            const isValid = parsedJson.every(item =>
                typeof item === 'object' && item !== null && 'attribute' in item && 'value' in item
            );
            if (isValid) {
                return parsedJson as Attribute[];
            }
        }
        throw new Error('Gemini API returned data in an unexpected format.');
    } catch (error) {
        console.error('Error fetching product attributes from Gemini:', error);
        if (error instanceof Error) {
            throw new Error(`Failed to fetch attributes from Gemini: ${error.message}`);
        }
        throw new Error('An unknown error occurred while fetching attributes from Gemini.');
    }
};

const fetchWithPerplexity = async (productLink: string, apiKey: string, schema?: any, category?: string): Promise<Attribute[]> => {
    let systemPrompt: string;
    let userContent: string;

    if (schema && category) {
        systemPrompt = `You are an expert AI assistant specializing in e-commerce product data extraction. Your task is to analyze a product page URL and extract its key specifications into a structured JSON format, strictly following the provided structure for the category "${category}".

**Extraction Guidelines:**
- **FOCUS ON:** Only the attributes defined in the provided JSON structure.
- **DO NOT INCLUDE:** Any attributes not present in the structure. Do not include pricing, shipping, reviews, etc. unless they are part of the schema.
- **Output Format:** You MUST return a valid JSON array. Each element must be an object with two string keys: "attribute" and "value". Do not include any explanatory text or anything outside of the JSON array.

**JSON Structure for Category "${category}":**
${JSON.stringify(schema, null, 2)}`;
        userContent = `Using the provided structure, extract attributes for the category "${category}" from the URL: ${productLink}`;

    } else {
        systemPrompt = `
You are an expert AI assistant specializing in e-commerce product data extraction. Your primary function is to analyze a product page URL and extract its key specifications into a structured JSON format.

**Your Goal:**
Create a comprehensive list of product attributes and their corresponding values based on the content of the provided URL.

**Extraction Guidelines:**
- **FOCUS ON:** Technical specifications (e.g., CPU, RAM), physical properties (e.g., dimensions, weight, material), features (e.g., Screen Type, Resolution), and other core product details.
- **DO NOT INCLUDE:**
    - Pricing, discounts, or sale information.
    - Shipping details, delivery times, or return policies.
    - Stock status, availability, or "in stock" messages.
    - Customer reviews, ratings, or Q&A sections.
    - Marketing jargon, slogans, or promotional text.
    - Information about related or recommended products.
    -Make all the first letter in CAPITAL in the attribute names
Capture multiple values using "Coma" as a separator when there are multiple values available and avoid duplicate attribute names within SKU ID
You must capture the values only from the provided source links and not beyond that.
**Output Format:**
- You MUST return a valid JSON array.
- Each element in the array must be an object with two string keys: "attribute" and "value".
- Do not include any explanatory text, markdown formatting (like \`\`\`json), or anything outside of the JSON array itself.

**Example of correct output:**
[
  { "attribute": "Color", "value": "Midnight Black" },
  { "attribute": "Screen Size", "value": "6.7 inches" },
  { "attribute": "Material", "value": "Aluminum, Glass" }
]
`;
        userContent = `Capture the possible attributes and values from the selected link. URL: ${productLink}`;
    }

    try {
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'sonar-pro',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userContent }
                ]
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Perplexity API Error Response:', errorBody);
            throw new Error(`Perplexity API request failed with status ${response.status}.`);
        }

        const data = await response.json();
        const jsonString = data.choices[0]?.message?.content;

        if (!jsonString) {
            throw new Error('No content returned from Perplexity API.');
        }

        const cleanedJsonString = jsonString.replace(/```json\n?|```/g, '').trim();
        const parsedJson = JSON.parse(cleanedJsonString);

        if (Array.isArray(parsedJson)) {
            const isValid = parsedJson.every(item =>
                typeof item === 'object' && item !== null && 'attribute' in item && 'value' in item
            );
            if (isValid) {
                return parsedJson as Attribute[];
            }
        }
        throw new Error('Perplexity API did not return a valid JSON array.');
    } catch (error) {
        console.error('Error fetching product attributes from Perplexity:', error);
        if (error instanceof Error) {
            if (error.message.includes('401')) {
                throw new Error('Authentication failed. Please check your Perplexity API key.');
            }
            throw new Error(`Failed to fetch attributes from Perplexity: ${error.message}`);
        }
        throw new Error('An unknown error occurred while fetching attributes from Perplexity.');
    }
};

export const fetchProductAttributes = async (productLink: string, apiKey: string, schema?: any, category?: string): Promise<Attribute[]> => {
    if (!apiKey) {
        throw new Error("API key is not configured. Please enter and save your API key.");
    }
    
    const cleanedApiKey = apiKey.trim();

    // Gemini API keys start with 'AIza'
    if (cleanedApiKey.startsWith('AIza')) {
        return fetchWithGemini(productLink, cleanedApiKey, schema, category);
    } else {
        // Assume it's a Perplexity key otherwise
        return fetchWithPerplexity(productLink, cleanedApiKey, schema, category);
    }
};

export const validateApiKey = async (apiKey: string): Promise<{ isValid: boolean; error?: string; provider?: 'Gemini' | 'Perplexity' }> => {
    if (!apiKey) {
        return { isValid: false, error: 'API key is empty.' };
    }

    const cleanedApiKey = apiKey.trim();

    if (cleanedApiKey.startsWith('AIza')) { // Gemini
        try {
            const ai = new GoogleGenAI({ apiKey: cleanedApiKey });
            // Use a simple, low-token prompt for validation
            await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: 'Hi',
            });
            return { isValid: true, provider: 'Gemini' };
        } catch (error) {
            console.error('Gemini API Key Validation Error:', error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            return { isValid: false, provider: 'Gemini', error: `Gemini validation failed: ${errorMessage}` };
        }
    } else { // Perplexity
        try {
            const response = await fetch('https://api.perplexity.ai/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cleanedApiKey}`
                },
                body: JSON.stringify({
                    model: 'sonar-pro', // Use a small, cheap model for validation
                    messages: [{ role: 'user', content: 'Hi' }],
                    max_tokens: 5
                })
            });

            if (!response.ok) {
                 const errorBody = await response.json().catch(() => ({ message: 'Failed to parse error response.' }));
                 const errorMessage = errorBody.error?.message || `API returned status ${response.status}`;
                 throw new Error(errorMessage);
            }
            
            return { isValid: true, provider: 'Perplexity' };
        } catch (error) {
            console.error('Perplexity API Key Validation Error:', error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            return { isValid: false, provider: 'Perplexity', error: `Perplexity validation failed: ${errorMessage}` };
        }
    }
};