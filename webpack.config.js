const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = (env, mode) => {
  return {
    mode: mode,
    entry: "./src/index.ts",
    resolve: {
      extensions: [".ts", ".js"],
    },
    output: {
      path: __dirname + "/dist",
      filename: "bundle.js",
    },
    devtool: !env.production ? "cheap-module-source-map" : false,
    devServer: {
      static: path.join(__dirname, "dist"),
      hot: true,
      
    },
    module: {
      rules: [
        {
          test: /\.ts?$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: ["@babel/preset-env"],
            },
          },
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        inject: false,
        hash: false,
        template: path.join(__dirname, "/src/index.html"),
        filename: "index.html",
      }),
    ],
  };
};
