import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
    ...nextCoreWebVitals,
    {
        ignores: [
            ".next/**",
            "android/**",
            "archive/**",
            "node_modules/**",
            "out/**",
            "playwright-report/**",
            "test-results/**",
        ],
    },
];

export default config;
