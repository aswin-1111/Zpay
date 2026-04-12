import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLocation, useNavigate } from "react-router-dom";

import "./App.css";
import { parseBankStatement } from "./parser";

function Loader() {
    const navigate = useNavigate();
    const location = useLocation();
    const file = location.state?.file as File | undefined;

    useEffect(() => {
        if (!file) {
            navigate("/");
            return;
        }

        const processFile = async () => {
            try {
                const parsed = await parseBankStatement(file);

                await invoke("save_parquet", {
                    data: parsed,
                });
                
                navigate("/dashboard");
              } catch (err) {
                console.error(err);
                navigate("/");
                alert("Failed to process the uploaded file.");
            }
        };

        processFile();
    }, [file, navigate]);
  
    return (
        <div className="loader"></div>
    );
}


export default Loader;


