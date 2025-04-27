/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerLanguage } from 'monaco-sql-languages/esm/_.contribution';
import { LanguageIdEnum } from 'monaco-sql-languages/esm/common/constants';
import { setupLanguageFeatures } from 'monaco-sql-languages/esm/setupLanguageFeatures';

registerLanguage({
  id: LanguageIdEnum.DUCKDB,
  extensions: ['.duckdb'],
  aliases: ['DuckDB', 'duckdb'],
  loader: () => import('./duckdb'),
});

setupLanguageFeatures(LanguageIdEnum.DUCKDB, {
  completionItems: true,
  diagnostics: true,
  references: true,
  definitions: true,
});
