'use client';

import React, { useState } from 'react';
import { Upload, FileDown, Loader2 } from 'lucide-react';

const SpreadsheetOCR = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [extractedData, setExtractedData] = useState(null);
  const [progress, setProgress] = useState(0);

  async function processImage(file) {
    try {
      setIsProcessing(true);
      setError('');

      // Convert file to base64
      const base64Image = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });

      // Dynamically import Tesseract.js
      const { createWorker } = (await import('tesseract.js')).default;

      // Create worker with progress logger
      const worker = await createWorker({
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      await worker.setParameters({
        tessedit_char_whitelist:
          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,#-_ ',
      });

      // Perform OCR
      const {
        data: { text },
      } = await worker.recognize(base64Image);

      // Clean up worker
      await worker.terminate();

      // Process the OCR result
      const lines = text.split('\n').filter((line) => line.trim());

      // Extract headers from first line
      const headers = lines[0]
        .split(/\s+/)
        .map((header) =>
          header.trim().toLowerCase().replace(/\s+/g, '_')
        )
        .filter(Boolean);

      // Process data rows
      const processedData = lines
        .slice(1)
        .filter((line) => line.trim())
        .map((line) => {
          const values = line.split(/\s+/).filter(Boolean);
          const row = {};

          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });

          return row;
        })
        .filter((row) => Object.values(row).some((value) => value));

      setExtractedData(processedData);
      setIsProcessing(false);
      setProgress(0);
    } catch (err) {
      console.error('OCR Error:', err);
      setError('Error processing image. Please try again.');
      setIsProcessing(false);
      setProgress(0);
    }
  }

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.includes('image/')) {
      setError('Please upload an image file');
      return;
    }

    processImage(file);
  };

  const exportToCSV = () => {
    if (!extractedData) return;

    const headers = Object.keys(extractedData[0]);
    const csvContent = [
      headers.join(','),
      ...extractedData.map((row) =>
        headers
          .map((header) => JSON.stringify(row[header] || ''))
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'spreadsheet_data.csv';
    link.click();
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            Spreadsheet OCR Converter
          </h2>
        </div>

        <div className="p-6">
          <div className="flex flex-col gap-4">
            {!isProcessing && !extractedData && (
              <label className="w-full h-32 flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 border-gray-300">
                <div className="flex flex-col items-center justify-center">
                  <Upload className="w-8 h-8 mb-2 text-gray-500" />
                  <p className="text-sm text-gray-500">
                    Upload spreadsheet screenshot
                  </p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileUpload}
                />
              </label>
            )}

            {isProcessing && (
              <div className="flex flex-col items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin mb-2 text-blue-500" />
                <p className="text-sm text-gray-500 mb-2">
                  Processing image... {progress}%
                </p>
                <div className="w-full h-2 bg-gray-200 rounded-full">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-500 p-4 rounded-lg border border-red-200">
                {error}
              </div>
            )}

            {extractedData && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    onClick={exportToCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <FileDown className="w-4 h-4" />
                    Export CSV
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {Object.keys(extractedData[0]).map(
                          (header) => (
                            <th
                              key={header}
                              className="p-2 text-left bg-gray-100 border border-gray-200"
                            >
                              {header
                                .replace(/_/g, ' ')
                                .toUpperCase()}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {extractedData.map((row, index) => (
                        <tr key={index}>
                          {Object.values(row).map((value, i) => (
                            <td
                              key={i}
                              className="p-2 border border-gray-200"
                            >
                              {value}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpreadsheetOCR;
