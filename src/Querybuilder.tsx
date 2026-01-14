import { Field, QueryBuilder, formatQuery, RuleGroupType } from 'react-querybuilder';
import { useState } from 'react';

function QueryBuilderPage() {
    const fields: Field[] = [
        { name: 'txn_date' , label: 'Txn Date', inputType: 'date' },
        { name: 'value_date' , label: 'Value Date', inputType: 'date'},
        { name: 'description' , label: 'Description'},
        { name: 'reference' , label: 'Reference'},
        { name: 'debit' , label: 'Debit', inputType: 'number'},
        { name: 'credit' , label: 'Credit', inputType: 'number'},
        { name: 'balance' , label: 'Balance', inputType: 'number'}
    ]

    const [query, setQuery] = useState<RuleGroupType>({
        combinator: 'and',
        rules: [
            { field: 'txn_date', operator: '>', value: '' },
            { field: 'value_date', operator: '<', value: '' },
        ],
    });

    return (
        <>
            <QueryBuilder fields={fields} query={query} onQueryChange={setQuery}/>
            <h1>
                <pre>{formatQuery(query, 'sql')}</pre>
            </h1>
        </>
    );
}
export default QueryBuilderPage;