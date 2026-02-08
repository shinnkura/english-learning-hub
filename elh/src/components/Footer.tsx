import React from "react";
import { Link } from "react-router-dom";
import { FileText, Plus } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/legal"
              className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-300"
            >
              <FileText className="w-5 h-5" />
              <span>利用規約</span>
            </Link>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} English Learning Hub. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}