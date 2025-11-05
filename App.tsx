
import React, { useState, useCallback, useEffect } from 'react';
import { Product, ProductStatus } from './types';
import { fetchProductAttributes, validateApiKey } from './services/geminiService';
import { UploadIcon, ProcessIcon, ExportIcon, SpinnerIcon, CheckCircleIcon, XCircleIcon, KeyIcon } from './components/icons';
import { SchemaSelection, SchemaMaster } from './components/SchemaComponents';
import type { Attribute } from './types';

// XLSX is loaded from a script tag in index.html
declare var XLSX: any;

const ApiKeyInput: React.FC<{ 
    apiKey: string; 
    onApiKeyChange: (key: string) => void;
    onValidationSuccess: () => void;
    onKeyDirty: () => void;
}> = ({ apiKey, onApiKeyChange, onValidationSuccess, onKeyDirty }) => {
    const [localApiKey, setLocalApiKey] = useState(apiKey);
    const [isSaved, setIsSaved] = useState(false);
    const [validationStatus, setValidationStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
    const [validationMessage, setValidationMessage] = useState<string | null>(null);

    const handleSave = () => {
        onApiKeyChange(localApiKey);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    };

    const handleValidate = async () => {
        setValidationStatus('validating');
        setValidationMessage(null);
        const result = await validateApiKey(localApiKey);
        if (result.isValid) {
            setValidationStatus('valid');
            setValidationMessage(`Successfully validated with ${result.provider}.`);
            onValidationSuccess();
        } else {
            setValidationStatus('invalid');
            setValidationMessage(result.error ?? 'Validation failed.');
        }
    };
    
    useEffect(() => {
        setLocalApiKey(apiKey);
    }, [apiKey]);
    
    useEffect(() => {
        // Reset validation status when the user types a new key
        setValidationStatus('idle');
        setValidationMessage(null);
        if (localApiKey !== apiKey) {
            onKeyDirty();
        }
    }, [localApiKey, apiKey, onKeyDirty]);

    const getValidationUI = () => {
        switch(validationStatus) {
            case 'validating':
                return <span className="flex items-center text-xs text-yellow-400"><SpinnerIcon className="w-4 h-4 mr-1" /> Validating...</span>;
            case 'valid':
                return <span className="flex items-center text-xs text-green-400"><CheckCircleIcon className="w-4 h-4 mr-1" /> {validationMessage}</span>;
            case 'invalid':
                return <span className="flex items-center text-xs text-red-400"><XCircleIcon className="w-4 h-4 mr-1" /> {validationMessage}</span>;
            default:
                return null;
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto bg-surface p-6 rounded-lg shadow-lg border border-slate-700">
            <label htmlFor="api-key-input" className="block text-sm font-medium text-text-secondary mb-2">
                Gemini or Perplexity API Key
            </label>
            <div className="flex items-center gap-2">
                <input
                    id="api-key-input"
                    type="password"
                    value={localApiKey}
                    onChange={(e) => setLocalApiKey(e.target.value)}
                    placeholder="Enter your API key"
                    className="flex-grow bg-slate-800 border border-slate-600 text-text-primary text-sm rounded-lg focus:ring-accent focus:border-accent block w-full p-2.5"
                />
                <button
                    onClick={handleValidate}
                    className="p-2.5 text-sm font-medium text-white bg-slate-600 rounded-lg hover:bg-slate-500 focus:ring-4 focus:outline-none focus:ring-slate-400 disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors"
                    disabled={!localApiKey || validationStatus === 'validating'}
                    title="Validate API Key"
                >
                    <KeyIcon />
                </button>
                <button
                    onClick={handleSave}
                    className="px-4 py-2.5 text-sm font-medium text-white bg-brand-secondary rounded-lg hover:bg-brand-dark focus:ring-4 focus:outline-none focus:ring-brand-light disabled:bg-slate-600 transition-colors"
                    disabled={!localApiKey || localApiKey === apiKey}
                >
                    {isSaved ? 'Saved!' : 'Save'}
                </button>
            </div>
             <div className="mt-2 text-xs text-text-secondary h-4">
                {validationStatus !== 'idle' ? getValidationUI() : <p>Your API key is stored in your browser's local storage.</p>}
            </div>
        </div>
    );
};

const FileUpload: React.FC<{ onFileUpload: (data: Product[]) => void, setAppError: (error: string) => void }> = ({ onFileUpload, setAppError }) => {
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    setAppError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (json.length < 2) {
            throw new Error("Excel sheet is empty or has no data rows.");
        }
        
        const findHeaderIndex = (headers: string[], possibleNames: string[]): number => {
            for (const name of possibleNames) {
                const index = headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
                if (index !== -1) {
                    return index;
                }
            }
            return -1;
        };

        const headers = json[0].map(h => String(h || '').trim());
        
        const skuIndex = findHeaderIndex(headers, ['sku id', 'sku', 'sku_id', 'product sku', 'item id', 'product id', 'identifier', 'hgg product code (internal sku)', 'supplier sku', 'hginternalcode']);
        const partNumberIndex = findHeaderIndex(headers, ['part number', 'part no', 'part #', 'part_number', 'model', 'model number', 'mpn', 'manufacturers part number (mpn)', 'pt_mpn_1']);
        const linkIndex = findHeaderIndex(headers, ['product link', 'link', 'url', 'product url', 'product_link', 'product page', 'website', 'pt_data source url_1', 'pt_data source url_2', 'pt_third party url 1']);

        const missingColumns: string[] = [];
        if (skuIndex === -1) missingColumns.push("'SKU ID'");
        if (partNumberIndex === -1) missingColumns.push("'Part Number'");
        if (linkIndex === -1) missingColumns.push("'Product Link'");

        if (missingColumns.length > 0) {
            const foundHeaders = headers.join("', '");
            throw new Error(`Invalid Excel format. Could not find required column(s): ${missingColumns.join(', ')}. Please check the headers in your file. Headers found: ['${foundHeaders}']`);
        }
        
        const products: Product[] = json.slice(1).map((row: any[], index: number) => ({
          id: index,
          sku: String(row[skuIndex] || ''),
          partNumber: String(row[partNumberIndex] || ''),
          link: String(row[linkIndex] || ''),
          status: ProductStatus.Pending,
        })).filter(p => p.sku && p.link);

        if (products.length === 0) {
            throw new Error("No valid product rows with both a SKU and a Product Link could be found in the uploaded file.");
        }

        onFileUpload(products);
      } catch (error) {
        console.error("Error processing file:", error);
        setAppError(error instanceof Error ? error.message : "An unknown error occurred while processing the file.");
        setFileName(null);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-surface p-6 rounded-lg shadow-lg border border-slate-700">
      <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-48 border-2 border-slate-600 border-dashed rounded-lg cursor-pointer bg-slate-800 hover:bg-slate-700 transition-colors">
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <UploadIcon className="w-10 h-10 mb-3 text-slate-400" />
          <p className="mb-2 text-sm text-text-secondary"><span className="font-semibold text-accent">Click to upload</span> or drag and drop</p>
          <p className="text-xs text-text-secondary">XLSX, XLS, or ODS file</p>
        </div>
        <input id="file-upload" type="file" className="hidden" accept=".xlsx, .xls, .ods" onChange={handleFileChange} />
      </label>
      {fileName && <p className="mt-4 text-center text-sm text-text-secondary">Uploaded: <span className="font-medium text-text-primary">{fileName}</span></p>}
    </div>
  );
};


const ProductTable: React.FC<{ 
    products: Product[],
    selectedIds: Set<number>, 
    onSelectionChange: (id: number) => void,
    onSelectAll: (checked: boolean) => void,
    isAllSelected: boolean
}> = ({ products, selectedIds, onSelectionChange, onSelectAll, isAllSelected }) => {
    
    const getStatusIndicator = (status: ProductStatus) => {
        switch(status) {
            case ProductStatus.Processing: return <span className="flex items-center text-yellow-400"><SpinnerIcon className="mr-2" /> Processing</span>;
            case ProductStatus.Done: return <span className="flex items-center text-green-400"><CheckCircleIcon className="mr-2" /> Done</span>;
            case ProductStatus.Error: return <span className="flex items-center text-red-400"><XCircleIcon className="mr-2" /> Error</span>;
            default: return <span className="text-slate-400">Pending</span>;
        }
    };
    
    return (
        <div className="w-full bg-surface rounded-lg shadow-lg border border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-text-secondary">
                    <thead className="text-xs text-text-primary uppercase bg-slate-800">
                        <tr>
                            <th scope="col" className="p-4">
                                <div className="flex items-center">
                                    <input id="checkbox-all" type="checkbox" className="w-4 h-4 text-brand-light bg-slate-600 border-slate-500 rounded focus:ring-brand-secondary focus:ring-2" 
                                    checked={isAllSelected} onChange={(e) => onSelectAll(e.target.checked)} />
                                    <label htmlFor="checkbox-all" className="sr-only">checkbox</label>
                                </div>
                            </th>
                            <th scope="col" className="px-6 py-3">SKU ID</th>
                            <th scope="col" className="px-6 py-3">Part Number</th>
                            <th scope="col" className="px-6 py-3">Product Link</th>
                            <th scope="col" className="px-6 py-3">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.map(product => (
                            <tr key={product.id} className="bg-surface border-b border-slate-700 hover:bg-slate-800">
                                <td className="w-4 p-4">
                                    <div className="flex items-center">
                                        <input id={`checkbox-${product.id}`} type="checkbox" className="w-4 h-4 text-brand-light bg-slate-600 border-slate-500 rounded focus:ring-brand-secondary"
                                        checked={selectedIds.has(product.id)} onChange={() => onSelectionChange(product.id)} />
                                        <label htmlFor={`checkbox-${product.id}`} className="sr-only">checkbox</label>
                                    </div>
                                </td>
                                <td className="px-6 py-4 font-medium text-text-primary whitespace-nowrap">{product.sku}</td>
                                <td className="px-6 py-4">{product.partNumber}</td>
                                <td className="px-6 py-4">
                                    <a href={product.link} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline truncate block max-w-xs">{product.link}</a>
                                </td>
                                <td className="px-6 py-4 font-mono text-xs">{getStatusIndicator(product.status)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
             {products.length > 0 && (
                <div className="p-4 bg-slate-800 border-t border-slate-700">
                    <h3 className="text-lg font-semibold text-text-primary mb-2">Extracted Attributes</h3>
                    <div className="max-h-96 overflow-y-auto space-y-4 pr-2">
                        {products.filter(p => p.status === ProductStatus.Done && p.attributes && p.attributes.length > 0).map(product => (
                            <div key={`attrs-${product.id}`} className="p-4 bg-slate-900/50 rounded-lg">
                               <p className="font-bold text-accent mb-2">SKU: {product.sku}</p>
                               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-sm">
                                   {product.attributes?.map((attr, index) => (
                                       <div key={index} className="bg-slate-800 p-2 rounded">
                                           <p className="font-semibold text-text-primary">{attr.attribute}</p>
                                           <p className="text-text-secondary">{attr.value}</p>
                                       </div>
                                   ))}
                               </div>
                            </div>
                        ))}
                         {products.filter(p => p.status === ProductStatus.Error).map(product => (
                            <div key={`error-${product.id}`} className="p-4 bg-red-900/50 rounded-lg">
                               <p className="font-bold text-red-400 mb-1">SKU: {product.sku}</p>
                               <p className="text-red-300 text-sm">Error: {product.error}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [appError, setAppError] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [isApiKeyValidated, setIsApiKeyValidated] = useState(false);
  const [workflowStep, setWorkflowStep] = useState<'file-upload' | 'schema-choice' | 'schema-master' | 'table-view'>('file-upload');
  const [schema, setSchema] = useState<any | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    const storedApiKey = localStorage.getItem('apiKey');
    if (storedApiKey) {
      setApiKey(storedApiKey);
    }
  }, []);

  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    localStorage.setItem('apiKey', key);
    setIsApiKeyValidated(false);
  };
  
  const handleFileUpload = (newProducts: Product[]) => {
    setProducts(newProducts);
    setSelectedIds(new Set());
    setWorkflowStep('schema-choice'); // Start the new workflow
  };
  
  const handleSchemaAndCategorySelected = (selectedSchema: any, selectedCategory: string) => {
    setSchema(selectedSchema);
    setCategory(selectedCategory);
    setWorkflowStep('table-view');
  };

  const handleSelectionChange = (id: number) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(products.map(p => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleFetch = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!apiKey) {
        setAppError("Please enter and save an API key before fetching attributes.");
        return;
    }
    if (!isApiKeyValidated) {
        setAppError("Please validate your API key before fetching attributes.");
        return;
    }
    setIsProcessing(true);
    setAppError('');

    // Set all selected products to 'Processing' status immediately for better UI feedback
    setProducts(prevProducts =>
        prevProducts.map(p =>
            selectedIds.has(p.id)
                ? { ...p, status: ProductStatus.Processing, attributes: undefined, error: undefined }
                : p
        )
    );

    const promises = Array.from(selectedIds).map(id => {
        const product = products.find(p => p.id === id);
        if (!product) {
            // This case should ideally not happen if state is consistent
            return Promise.resolve({ id, status: ProductStatus.Error, error: 'Product not found' });
        }

        return fetchProductAttributes(product.link, apiKey, schema, category)
            .then(attributes => ({ id, status: ProductStatus.Done, attributes }))
            .catch(error => ({ id, status: ProductStatus.Error, error: error instanceof Error ? error.message : "Unknown API error" }));
    });

    const results = await Promise.all(promises);

    // Update the state with all results at once
    setProducts(prevProducts => {
        const productsMap = new Map(prevProducts.map(p => [p.id, p]));
        
        results.forEach(result => {
            const currentProduct = productsMap.get(result.id);
            if (currentProduct) {
                // Fix: Use the 'in' operator for type narrowing to resolve property access errors on the union type.
                if ('attributes' in result) {
                    productsMap.set(result.id, {
                        ...currentProduct,
                        status: result.status,
                        attributes: result.attributes,
                        error: undefined,
                    });
                } else { // result.status === ProductStatus.Error
                    productsMap.set(result.id, {
                        ...currentProduct,
                        status: result.status,
                        error: result.error,
                        attributes: undefined,
                    });
                }
            }
        });

        return Array.from(productsMap.values());
    });

    setIsProcessing(false);
}, [selectedIds, products, apiKey, isApiKeyValidated, schema, category]);
  
  const handleExport = () => {
    const processedProducts = products.filter(p => p.status === ProductStatus.Done && p.attributes);
    if (processedProducts.length === 0) return;

    let maxAttributes = 0;
    processedProducts.forEach(p => {
        if (p.attributes && p.attributes.length > maxAttributes) {
            maxAttributes = p.attributes.length;
        }
    });

    const headers = ['SKU ID', 'Part Number', 'Product Link'];
    for (let i = 1; i <= maxAttributes; i++) {
        headers.push(`Attribute ${i}`, `Value ${i}`);
    }

    const rows = products.map(product => {
        const row = [product.sku, product.partNumber, product.link];
        if (product.status === ProductStatus.Done && product.attributes) {
            product.attributes.forEach(attr => {
                row.push(attr.attribute, attr.value);
            });
        }
        return row;
    });

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "product_attributes.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  };

  const canFetch = selectedIds.size > 0 && !isProcessing && !!apiKey && isApiKeyValidated;
  const canExport = products.some(p => p.status === ProductStatus.Done) && !isProcessing;
  const isAllSelected = products.length > 0 && selectedIds.size === products.length;

  const getFetchButtonTitle = () => {
    if (!apiKey) return "Please enter and save your API key first";
    if (!isApiKeyValidated) return "Please validate your API key first";
    if (selectedIds.size === 0) return "Select at least one product to fetch";
    return "";
  };

  return (
    <div className="min-h-screen bg-background font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">Product Attribute Extractor</h1>
          <p className="mt-4 text-lg text-text-secondary">Upload an Excel file, select products, and let AI extract attributes for you.</p>
        </header>

        {appError && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg relative" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{appError}</span>
          </div>
        )}

        <ApiKeyInput 
          apiKey={apiKey} 
          onApiKeyChange={handleApiKeyChange} 
          onValidationSuccess={() => setIsApiKeyValidated(true)}
          onKeyDirty={() => setIsApiKeyValidated(false)}
        />
        
        <FileUpload onFileUpload={handleFileUpload} setAppError={setAppError} />

        {products.length > 0 && (
          <div className="space-y-8">
            {workflowStep === 'schema-choice' && (
                <SchemaSelection
                    onSelectOnTheFly={() => {
                        setSchema(null);
                        setCategory(null);
                        setWorkflowStep('table-view');
                    }}
                    onSelectSchemaMaster={() => setWorkflowStep('schema-master')}
                />
            )}
            {workflowStep === 'schema-master' && (
                <SchemaMaster
                    onSchemaAndCategorySelected={handleSchemaAndCategorySelected}
                    setAppError={setAppError}
                />
            )}
            {workflowStep === 'table-view' && (
              <>
                <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                  <button 
                    onClick={handleFetch} 
                    disabled={!canFetch}
                    title={getFetchButtonTitle()}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-brand-secondary hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-light focus:ring-offset-background disabled:bg-slate-600 disabled:cursor-not-allowed transition-all"
                  >
                    {isProcessing ? <SpinnerIcon /> : <ProcessIcon />}
                    {isProcessing ? 'Processing...' : `Fetch Attributes (${selectedIds.size})`}
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={!canExport}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 border border-slate-600 text-base font-medium rounded-md shadow-sm text-text-primary bg-surface hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <ExportIcon />
                    Export to CSV
                  </button>
                </div>

                <ProductTable 
                    products={products} 
                    selectedIds={selectedIds}
                    onSelectionChange={handleSelectionChange}
                    onSelectAll={handleSelectAll}
                    isAllSelected={isAllSelected}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
