/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
  TokenClassConsts,
  postfixTokenClass,
} from 'monaco-sql-languages/esm/common/constants';
import { testTokenization } from 'monaco-sql-languages/esm/test/testRunner';

testTokenization('duckdb', [
  // Comments
  [
    {
      line: '-- a comment',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.COMMENT) },
      ],
    },
  ],

  [
    {
      line: '---sticky -- comment',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.COMMENT) },
      ],
    },
  ],

  [
    {
      line: '-almost a comment',
      tokens: [
        {
          startIndex: 0,
          type: postfixTokenClass(TokenClassConsts.OPERATOR_SYMBOL),
        },
        { startIndex: 1, type: postfixTokenClass(TokenClassConsts.IDENTIFIER) },
        { startIndex: 7, type: postfixTokenClass(TokenClassConsts.WHITE) },
        { startIndex: 8, type: postfixTokenClass(TokenClassConsts.IDENTIFIER) },
        { startIndex: 9, type: postfixTokenClass(TokenClassConsts.WHITE) },
        { startIndex: 10, type: postfixTokenClass(TokenClassConsts.KEYWORD) },
      ],
    },
  ],

  [
    {
      line: '/* a full line comment */',
      tokens: [
        {
          startIndex: 0,
          type: postfixTokenClass(TokenClassConsts.COMMENT_QUOTE),
        },
        { startIndex: 2, type: postfixTokenClass(TokenClassConsts.COMMENT) },
        {
          startIndex: 23,
          type: postfixTokenClass(TokenClassConsts.COMMENT_QUOTE),
        },
      ],
    },
  ],

  [
    {
      line: '/* /// *** /// */',
      tokens: [
        {
          startIndex: 0,
          type: postfixTokenClass(TokenClassConsts.COMMENT_QUOTE),
        },
        { startIndex: 2, type: postfixTokenClass(TokenClassConsts.COMMENT) },
        {
          startIndex: 15,
          type: postfixTokenClass(TokenClassConsts.COMMENT_QUOTE),
        },
      ],
    },
  ],

  [
    {
      line: '# comment',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.COMMENT) },
      ],
    },
  ],

  [
    {
      line: 'declare @x int = /* a simple comment */ 1;',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.KEYWORD) },
        { startIndex: 7, type: postfixTokenClass(TokenClassConsts.WHITE) },
        { startIndex: 8, type: postfixTokenClass(TokenClassConsts.IDENTIFIER) },
        { startIndex: 10, type: postfixTokenClass(TokenClassConsts.WHITE) },
        { startIndex: 11, type: postfixTokenClass(TokenClassConsts.TYPE) },
        { startIndex: 14, type: postfixTokenClass(TokenClassConsts.WHITE) },
        {
          startIndex: 15,
          type: postfixTokenClass(TokenClassConsts.OPERATOR_SYMBOL),
        },
        { startIndex: 16, type: postfixTokenClass(TokenClassConsts.WHITE) },
        {
          startIndex: 17,
          type: postfixTokenClass(TokenClassConsts.COMMENT_QUOTE),
        },
        { startIndex: 19, type: postfixTokenClass(TokenClassConsts.COMMENT) },
        {
          startIndex: 37,
          type: postfixTokenClass(TokenClassConsts.COMMENT_QUOTE),
        },
        { startIndex: 39, type: postfixTokenClass(TokenClassConsts.WHITE) },
        { startIndex: 40, type: postfixTokenClass(TokenClassConsts.NUMBER) },
        { startIndex: 41, type: postfixTokenClass(TokenClassConsts.DELIMITER) },
      ],
    },
  ],

  // Not supporting nested comments, as nested comments seem to not be standard?
  // i.e. http://stackoverflow.com/questions/728172/are-there-multiline-comment-delimiters-in-sql-that-are-vendor-agnostic
  [
    {
      line: '@x=/* a /* nested comment  1*/;',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.IDENTIFIER) },
        {
          startIndex: 2,
          type: postfixTokenClass(TokenClassConsts.OPERATOR_SYMBOL),
        },
        {
          startIndex: 3,
          type: postfixTokenClass(TokenClassConsts.COMMENT_QUOTE),
        },
        { startIndex: 5, type: postfixTokenClass(TokenClassConsts.COMMENT) },
        {
          startIndex: 28,
          type: postfixTokenClass(TokenClassConsts.COMMENT_QUOTE),
        },
        { startIndex: 30, type: postfixTokenClass(TokenClassConsts.DELIMITER) },
      ],
    },
  ],

  [
    {
      line: '@x=/* another comment */ 1*/;',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.IDENTIFIER) },
        {
          startIndex: 2,
          type: postfixTokenClass(TokenClassConsts.OPERATOR_SYMBOL),
        },
        {
          startIndex: 3,
          type: postfixTokenClass(TokenClassConsts.COMMENT_QUOTE),
        },
        { startIndex: 5, type: postfixTokenClass(TokenClassConsts.COMMENT) },
        {
          startIndex: 22,
          type: postfixTokenClass(TokenClassConsts.COMMENT_QUOTE),
        },
        { startIndex: 24, type: postfixTokenClass(TokenClassConsts.WHITE) },
        { startIndex: 25, type: postfixTokenClass(TokenClassConsts.NUMBER) },
        {
          startIndex: 26,
          type: postfixTokenClass(TokenClassConsts.OPERATOR_SYMBOL),
        },
        { startIndex: 28, type: postfixTokenClass(TokenClassConsts.DELIMITER) },
      ],
    },
  ],

  [
    {
      line: '@x=/*/;',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.IDENTIFIER) },
        {
          startIndex: 2,
          type: postfixTokenClass(TokenClassConsts.OPERATOR_SYMBOL),
        },
        {
          startIndex: 3,
          type: postfixTokenClass(TokenClassConsts.COMMENT_QUOTE),
        },
        { startIndex: 5, type: postfixTokenClass(TokenClassConsts.COMMENT) },
      ],
    },
  ],

  // Numbers
  [
    {
      line: '123',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.NUMBER) },
      ],
    },
  ],

  [
    {
      line: '-123',
      tokens: [
        {
          startIndex: 0,
          type: postfixTokenClass(TokenClassConsts.OPERATOR_SYMBOL),
        },
        { startIndex: 1, type: postfixTokenClass(TokenClassConsts.NUMBER) },
      ],
    },
  ],

  [
    {
      line: '0xaBc123',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.NUMBER_HEX) },
      ],
    },
  ],

  [
    {
      line: '0x',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.NUMBER_HEX) },
      ],
    },
  ],

  [
    {
      line: '0x0',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.NUMBER_HEX) },
      ],
    },
  ],

  [
    {
      line: '0xAB_CD',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.NUMBER_HEX) },
        { startIndex: 4, type: postfixTokenClass(TokenClassConsts.IDENTIFIER) },
      ],
    },
  ],

  [
    {
      line: '$',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.NUMBER) },
      ],
    },
  ],

  [
    {
      line: '$-123',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.NUMBER) },
      ],
    },
  ],

  [
    {
      line: '$-+-123',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.NUMBER) },
      ],
    },
  ],

  [
    {
      line: '$123.5678',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.NUMBER) },
      ],
    },
  ],

  [
    {
      line: '$0.99',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.NUMBER) },
      ],
    },
  ],

  [
    {
      line: '$.99',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.NUMBER) },
      ],
    },
  ],

  [
    {
      line: '$99.',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.NUMBER) },
      ],
    },
  ],

  [
    {
      line: '$0.',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.NUMBER) },
      ],
    },
  ],

  [
    {
      line: '$.0',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.NUMBER) },
      ],
    },
  ],

  [
    {
      line: '.',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.DELIMITER) },
      ],
    },
  ],

  [
    {
      line: '123',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.NUMBER) },
      ],
    },
  ],

  [
    {
      line: '123.5678',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.NUMBER) },
      ],
    },
  ],

  [
    {
      line: '0.99',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.NUMBER) },
      ],
    },
  ],

  [
    {
      line: '.99',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.NUMBER) },
      ],
    },
  ],

  [
    {
      line: '99.',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.NUMBER) },
      ],
    },
  ],

  [
    {
      line: '0.',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.NUMBER) },
      ],
    },
  ],

  [
    {
      line: '.0',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.NUMBER) },
      ],
    },
  ],

  [
    {
      line: '1E-2',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.NUMBER) },
      ],
    },
  ],

  [
    {
      line: '1E+2',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.NUMBER) },
      ],
    },
  ],

  [
    {
      line: '1E2',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.NUMBER) },
      ],
    },
  ],

  [
    {
      line: '0.1E2',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.NUMBER) },
      ],
    },
  ],

  [
    {
      line: '1.E2',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.NUMBER) },
      ],
    },
  ],

  [
    {
      line: '.1E2',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.NUMBER) },
      ],
    },
  ],

  // Identifiers

  [
    {
      line: 'declare `abc 321`;',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.KEYWORD) },
        { startIndex: 7, type: postfixTokenClass(TokenClassConsts.WHITE) },
        {
          startIndex: 8,
          type: postfixTokenClass(TokenClassConsts.IDENTIFIER_QUOTE),
        },
        { startIndex: 17, type: postfixTokenClass(TokenClassConsts.DELIMITER) },
      ],
    },
  ],

  [
    {
      line: '`abc`` 321 `` xyz`',
      tokens: [
        {
          startIndex: 0,
          type: postfixTokenClass(TokenClassConsts.IDENTIFIER_QUOTE),
        },
      ],
    },
  ],

  [
    {
      line: '`abc',
      tokens: [
        {
          startIndex: 0,
          type: postfixTokenClass(TokenClassConsts.IDENTIFIER_QUOTE),
        },
      ],
    },
  ],

  [
    {
      line: 'int',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.TYPE) },
      ],
    },
  ],

  [
    {
      line: '`int`',
      tokens: [
        {
          startIndex: 0,
          type: postfixTokenClass(TokenClassConsts.IDENTIFIER_QUOTE),
        },
      ],
    },
  ],

  // Strings
  [
    {
      line: "declare @x='a string';",
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.KEYWORD) },
        { startIndex: 7, type: postfixTokenClass(TokenClassConsts.WHITE) },
        { startIndex: 8, type: postfixTokenClass(TokenClassConsts.IDENTIFIER) },
        {
          startIndex: 10,
          type: postfixTokenClass(TokenClassConsts.OPERATOR_SYMBOL),
        },
        { startIndex: 11, type: postfixTokenClass(TokenClassConsts.STRING) },
        {
          startIndex: 12,
          type: postfixTokenClass(TokenClassConsts.STRING_ESCAPE),
        },
        { startIndex: 20, type: postfixTokenClass(TokenClassConsts.STRING) },
        { startIndex: 21, type: postfixTokenClass(TokenClassConsts.DELIMITER) },
      ],
    },
  ],

  [
    {
      line: 'declare @x="a string";',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.KEYWORD) },
        { startIndex: 7, type: postfixTokenClass(TokenClassConsts.WHITE) },
        { startIndex: 8, type: postfixTokenClass(TokenClassConsts.IDENTIFIER) },
        {
          startIndex: 10,
          type: postfixTokenClass(TokenClassConsts.OPERATOR_SYMBOL),
        },
        { startIndex: 11, type: postfixTokenClass(TokenClassConsts.STRING) },
        {
          startIndex: 12,
          type: postfixTokenClass(TokenClassConsts.STRING_ESCAPE),
        },
        { startIndex: 20, type: postfixTokenClass(TokenClassConsts.STRING) },
        { startIndex: 21, type: postfixTokenClass(TokenClassConsts.DELIMITER) },
      ],
    },
  ],

  [
    {
      line: "'a '' string with quotes'",
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.STRING) },
        {
          startIndex: 1,
          type: postfixTokenClass(TokenClassConsts.STRING_ESCAPE),
        },
        { startIndex: 3, type: postfixTokenClass(TokenClassConsts.STRING) },
        {
          startIndex: 5,
          type: postfixTokenClass(TokenClassConsts.STRING_ESCAPE),
        },
        { startIndex: 24, type: postfixTokenClass(TokenClassConsts.STRING) },
      ],
    },
  ],

  [
    {
      line: '"a "" string with quotes"',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.STRING) },
        {
          startIndex: 1,
          type: postfixTokenClass(TokenClassConsts.STRING_ESCAPE),
        },
        { startIndex: 3, type: postfixTokenClass(TokenClassConsts.STRING) },
        {
          startIndex: 5,
          type: postfixTokenClass(TokenClassConsts.STRING_ESCAPE),
        },
        { startIndex: 24, type: postfixTokenClass(TokenClassConsts.STRING) },
      ],
    },
  ],

  [
    {
      line: "'a \" string with quotes'",
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.STRING) },
        {
          startIndex: 1,
          type: postfixTokenClass(TokenClassConsts.STRING_ESCAPE),
        },
        { startIndex: 23, type: postfixTokenClass(TokenClassConsts.STRING) },
      ],
    },
  ],

  [
    {
      line: '"a ` string with quotes"',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.STRING) },
        {
          startIndex: 1,
          type: postfixTokenClass(TokenClassConsts.STRING_ESCAPE),
        },
        { startIndex: 23, type: postfixTokenClass(TokenClassConsts.STRING) },
      ],
    },
  ],

  [
    {
      line: "'a -- string with comment'",
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.STRING) },
        {
          startIndex: 1,
          type: postfixTokenClass(TokenClassConsts.STRING_ESCAPE),
        },
        { startIndex: 25, type: postfixTokenClass(TokenClassConsts.STRING) },
      ],
    },
  ],

  [
    {
      line: '"a -- string with comment"',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.STRING) },
        {
          startIndex: 1,
          type: postfixTokenClass(TokenClassConsts.STRING_ESCAPE),
        },
        { startIndex: 25, type: postfixTokenClass(TokenClassConsts.STRING) },
      ],
    },
  ],

  [
    {
      line: "'a endless string",
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.STRING) },
        {
          startIndex: 1,
          type: postfixTokenClass(TokenClassConsts.STRING_ESCAPE),
        },
      ],
    },
  ],

  [
    {
      line: '"a endless string',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.STRING) },
        {
          startIndex: 1,
          type: postfixTokenClass(TokenClassConsts.STRING_ESCAPE),
        },
      ],
    },
  ],

  // Operators
  [
    {
      line: 'SET @x=@x+1',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.TYPE) },
        { startIndex: 3, type: postfixTokenClass(TokenClassConsts.WHITE) },
        { startIndex: 4, type: postfixTokenClass(TokenClassConsts.IDENTIFIER) },
        {
          startIndex: 6,
          type: postfixTokenClass(TokenClassConsts.OPERATOR_SYMBOL),
        },
        { startIndex: 7, type: postfixTokenClass(TokenClassConsts.IDENTIFIER) },
        {
          startIndex: 9,
          type: postfixTokenClass(TokenClassConsts.OPERATOR_SYMBOL),
        },
        { startIndex: 10, type: postfixTokenClass(TokenClassConsts.NUMBER) },
      ],
    },
  ],

  [
    {
      line: '@x^=@x',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.IDENTIFIER) },
        {
          startIndex: 2,
          type: postfixTokenClass(TokenClassConsts.OPERATOR_SYMBOL),
        },
        { startIndex: 4, type: postfixTokenClass(TokenClassConsts.IDENTIFIER) },
      ],
    },
  ],

  [
    {
      line: 'WHERE myfield IS NOT NULL',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.KEYWORD) },
        { startIndex: 5, type: postfixTokenClass(TokenClassConsts.WHITE) },
        { startIndex: 6, type: postfixTokenClass(TokenClassConsts.IDENTIFIER) },
        { startIndex: 13, type: postfixTokenClass(TokenClassConsts.WHITE) },
        {
          startIndex: 14,
          type: postfixTokenClass(TokenClassConsts.OPERATOR_KEYWORD),
        },
      ],
    },
  ],

  [
    {
      line: 'SELECT * FROM tbl WHERE MyColumn IN (1,2)',
      tokens: [
        { startIndex: 0, type: postfixTokenClass(TokenClassConsts.KEYWORD) },
        { startIndex: 6, type: postfixTokenClass(TokenClassConsts.WHITE) },
        {
          startIndex: 7,
          type: postfixTokenClass(TokenClassConsts.OPERATOR_SYMBOL),
        },
        { startIndex: 8, type: postfixTokenClass(TokenClassConsts.WHITE) },
        { startIndex: 9, type: postfixTokenClass(TokenClassConsts.KEYWORD) },
        { startIndex: 13, type: postfixTokenClass(TokenClassConsts.WHITE) },
        {
          startIndex: 14,
          type: postfixTokenClass(TokenClassConsts.IDENTIFIER),
        },
        { startIndex: 17, type: postfixTokenClass(TokenClassConsts.WHITE) },
        { startIndex: 18, type: postfixTokenClass(TokenClassConsts.KEYWORD) },
        { startIndex: 23, type: postfixTokenClass(TokenClassConsts.WHITE) },
        {
          startIndex: 24,
          type: postfixTokenClass(TokenClassConsts.IDENTIFIER),
        },
        { startIndex: 32, type: postfixTokenClass(TokenClassConsts.WHITE) },
        {
          startIndex: 33,
          type: postfixTokenClass(TokenClassConsts.OPERATOR_KEYWORD),
        },
        { startIndex: 35, type: postfixTokenClass(TokenClassConsts.WHITE) },
        {
          startIndex: 36,
          type: postfixTokenClass(TokenClassConsts.DELIMITER_PAREN),
        },
        { startIndex: 37, type: postfixTokenClass(TokenClassConsts.NUMBER) },
        { startIndex: 38, type: postfixTokenClass(TokenClassConsts.DELIMITER) },
        { startIndex: 39, type: postfixTokenClass(TokenClassConsts.NUMBER) },
        {
          startIndex: 40,
          type: postfixTokenClass(TokenClassConsts.DELIMITER_PAREN),
        },
      ],
    },
  ],
]);
