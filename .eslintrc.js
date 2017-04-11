module.exports = {
    "extends": "google",
    "rules": {
        "camelcase": [1, {
            "properties": "never"
        }],
        "curly": 0,
        "default-case": 1,
        "eol-last": 0,
        "indent": ["error", "tab", {"SwitchCase": 1}],
        "max-len": 0,
        "new-cap": 1,
        "no-console": 2,
        "no-extend-native": 0,
        "no-loop-func": 0,
        "no-return-assign": 0,
        "no-unused-vars": 1,
        "no-var": 1,
        "prefer-const": 1,
        "require-jsdoc": 0,
        "linebreak-style": 0
    }
};