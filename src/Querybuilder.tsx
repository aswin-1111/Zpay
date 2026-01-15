import { Field, QueryBuilder, formatQuery, RuleGroupType } from 'react-querybuilder';
import { useState } from 'react';

import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';


function QueryBuilderPage() {
  const fields: Field[] = [
    { name: 'txn_date', label: 'Txn Date', inputType: 'date' },
    { name: 'value_date', label: 'Value Date', inputType: 'date' },
    { name: 'description', label: 'Description' },
    { name: 'reference', label: 'Reference' },
    { name: 'debit', label: 'Debit', inputType: 'number' },
    { name: 'credit', label: 'Credit', inputType: 'number' },
    { name: 'balance', label: 'Balance', inputType: 'number' }
  ];

  const [query, setQuery] = useState<RuleGroupType>({
    combinator: 'and',
    rules: [
      { field: 'txn_date', operator: '>', value: '' },
      { field: 'value_date', operator: '<', value: '' }
    ]
  });

  /* ---------------- SAVE QUERY ---------------- */
  const saveQueryToFile = async () => {
    const filePath = await save({
      filters: [
        {
          name: 'Query JSON',
          extensions: ['json']
        }
      ],
      defaultPath: 'query.json'
    });

    if (!filePath) return;

    const json = JSON.stringify(query, null, 2);
    await writeTextFile(filePath, json);
  };

  /* ---------------- LOAD QUERY ---------------- */
  const loadQueryFromFile = async () => {
    const selected = await open({
      filters: [
        {
          name: 'Query JSON',
          extensions: ['json']
        }
      ],
      multiple: false
    });

    if (!selected || Array.isArray(selected)) return;

    const contents = await readTextFile(selected);
    const parsedQuery: RuleGroupType = JSON.parse(contents);

    // Update QueryBuilder state → UI reflects immediately
    setQuery(parsedQuery);
  };

  return (
    <>
      <div style={{ marginBottom: '1rem' }}>
        <button onClick={saveQueryToFile}>💾 Save Query</button>
        <button onClick={loadQueryFromFile} style={{ marginLeft: '1rem' }}>
          📂 Load Query
        </button>
      </div>

      <QueryBuilder
        fields={fields}
        query={query}
        onQueryChange={setQuery}
      />

      <h3>SQL Preview</h3>
      <pre>{formatQuery(query, 'sql')}</pre>
    </>
  );
}

export default QueryBuilderPage;
