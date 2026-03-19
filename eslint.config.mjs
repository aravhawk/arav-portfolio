import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ["blog-editor/"],
  },
];

export default eslintConfig;
