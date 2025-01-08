import { CssVarsProvider } from "@mui/joy/styles";
import "@xyflow/react/dist/style.css";
import { Suspense } from "react";
import { RouterProvider } from "react-router-dom";
import { LoadingPage } from "./pages/LoadingPage";
import router from "./routes";

export default function App() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <CssVarsProvider>
        <RouterProvider router={router} />
      </CssVarsProvider>
    </Suspense>
  );
}
