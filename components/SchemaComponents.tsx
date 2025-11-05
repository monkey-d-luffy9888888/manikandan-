import React, { useState } from 'react';
import { UploadIcon } from './icons';

export const SchemaSelection: React.FC<{
  onSelectOnTheFly: () => void;
  onSelectSchemaMaster: () => void;
}> = ({ onSelectOnTheFly, onSelectSchemaMaster }) => {
  return (
    <div className="w-full max-w-2xl mx-auto bg-surface p-6 rounded-lg shadow-lg border border-slate-700 text-center">
      <h2 className="text-2xl font-bold text-text-primary mb-4">Choose Attribute Extraction Method</h2>
      <p className="text-text-secondary mb-6">"On the Fly" automatically finds attributes. "Schema Master" lets you define exactly what to look for.</p>
      <div className="flex flex-col sm:flex-row justify-center gap-4">
        <button onClick={onSelectOnTheFly} className="w-full sm:w-auto flex-1 px-6 py-3 font-medium rounded-md text-white bg-brand-secondary hover:bg-brand-dark transition-all">
          On the Fly Schema
        </button>
        <button onClick={onSelectSchemaMaster} className="w-full sm:w-auto flex-1 px-6 py-3 font-medium rounded-md text-text-primary bg-surface hover:bg-slate-700 border border-slate-600 transition-all">
          Schema Master
        </button>
      </div>
    </div>
  );
};

export const SchemaMaster: React.FC<{
  onSchemaAndCategorySelected: (schema: any, category: string) => void;
  setAppError: (error: string) => void;
}> = ({ onSchemaAndCategorySelected, setAppError }) => {
    const [mode, setMode] = useState<'choice' | 'manual' | 'upload'>('choice');
    const [schemaText, setSchemaText] = useState('');
    const [fileName, setFileName] = useState<string | null>(null);
    const [parsedSchema, setParsedSchema] = useState<any | null>(null);
    const [categories, setCategories] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('');

    const processSchema = (text: string) => {
        setAppError('');
        try {
            const schema = JSON.parse(text);
            if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
                throw new Error("Schema must be a JSON object with categories as keys.");
            }
            const catKeys = Object.keys(schema);
            if (catKeys.length === 0) {
                throw new Error("Schema JSON is empty or does not contain any categories.");
            }
            setParsedSchema(schema);
            setCategories(catKeys);
            setSelectedCategory(catKeys[0]); // Select the first category by default
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Invalid JSON format.";
            setAppError(`Schema Error: ${errorMessage}`);
            setParsedSchema(null);
            setCategories([]);
            setSelectedCategory('');
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setFileName(file.name);
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                setSchemaText(text);
                processSchema(text);
            };
            reader.readAsText(file);
        }
    };
    
    const handleSubmit = () => {
        if (parsedSchema && selectedCategory) {
            onSchemaAndCategorySelected(parsedSchema[selectedCategory], selectedCategory);
        }
    };
    
    if (parsedSchema) {
        return (
            <div className="w-full max-w-2xl mx-auto bg-surface p-6 rounded-lg shadow-lg border border-slate-700">
                <h3 className="text-xl font-bold text-text-primary mb-4">Select Category</h3>
                <p className="text-text-secondary mb-4">The schema was processed successfully. Please select a category to apply to your products.</p>
                <select 
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="bg-slate-800 border border-slate-600 text-text-primary text-sm rounded-lg focus:ring-accent focus:border-accent block w-full p-2.5 mb-6"
                >
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <button 
                    onClick={handleSubmit}
                    className="w-full px-6 py-3 font-medium rounded-md text-white bg-brand-secondary hover:bg-brand-dark transition-all"
                >
                    Apply Schema and Continue
                </button>
            </div>
        );
    }
    
    return (
        <div className="w-full max-w-2xl mx-auto bg-surface p-6 rounded-lg shadow-lg border border-slate-700">
            {mode === 'choice' && (
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-text-primary mb-4">Provide a Schema</h2>
                    <p className="text-text-secondary mb-6">A schema is a JSON file defining categories and the attributes to extract for each.</p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                         <button onClick={() => setMode('manual')} className="w-full sm:w-auto flex-1 px-6 py-3 font-medium rounded-md text-text-primary bg-surface hover:bg-slate-700 border border-slate-600 transition-all">
                            Enter Schema Manually
                        </button>
                        <button onClick={() => setMode('upload')} className="w-full sm:w-auto flex-1 px-6 py-3 font-medium rounded-md text-text-primary bg-surface hover:bg-slate-700 border border-slate-600 transition-all">
                            Upload Schema File
                        </button>
                    </div>
                </div>
            )}
            
            {mode === 'manual' && (
                <div>
                    <h3 className="text-xl font-bold text-text-primary mb-2">Enter Schema Manually</h3>
                    <p className="text-text-secondary mb-4 text-sm">Paste your schema JSON below. The schema should be an object where each key is a category name.</p>
                    <textarea
                        value={schemaText}
                        onChange={(e) => setSchemaText(e.target.value)}
                        placeholder='{ "MyCategory": { "type": "ARRAY", "items": { ... } } }'
                        className="w-full h-64 bg-slate-800 border border-slate-600 text-text-primary text-sm rounded-lg focus:ring-accent focus:border-accent block p-2.5 font-mono"
                    />
                    <div className="mt-4 flex gap-4">
                        <button onClick={() => processSchema(schemaText)} className="flex-1 px-6 py-3 font-medium rounded-md text-white bg-brand-secondary hover:bg-brand-dark transition-all">
                            Process Schema
                        </button>
                         <button onClick={() => setMode('choice')} className="flex-1 px-6 py-3 font-medium rounded-md text-text-secondary bg-slate-600 hover:bg-slate-500 transition-all">
                            Back
                        </button>
                    </div>
                </div>
            )}

            {mode === 'upload' && (
                <div>
                    <h3 className="text-xl font-bold text-text-primary mb-4">Upload Schema File</h3>
                     <label htmlFor="schema-file-upload" className="flex flex-col items-center justify-center w-full h-48 border-2 border-slate-600 border-dashed rounded-lg cursor-pointer bg-slate-800 hover:bg-slate-700 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <UploadIcon className="w-10 h-10 mb-3 text-slate-400" />
                            <p className="mb-2 text-sm text-text-secondary"><span className="font-semibold text-accent">Click to upload</span> a schema file</p>
                            <p className="text-xs text-text-secondary">JSON file</p>
                        </div>
                        <input id="schema-file-upload" type="file" className="hidden" accept=".json,application/json" onChange={handleFileChange} />
                    </label>
                     {fileName && <p className="mt-4 text-center text-sm text-text-secondary">Uploaded: <span className="font-medium text-text-primary">{fileName}</span></p>}
                     <div className="mt-4">
                        <button onClick={() => setMode('choice')} className="w-full px-6 py-3 font-medium rounded-md text-text-secondary bg-slate-600 hover:bg-slate-500 transition-all">
                            Back
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
