import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowRight, Menu, X } from "lucide-react";
import Brand from "./Brand";
import Button from "./ui/Button";

export default function Header() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const navLinks = [
    { label: "Features", href: "/features" },
    { label: "How It Works", href: "/how-it-works" },
    { label: "Live Demo", href: "/demo" },
    { label: "Responsible AI", href: "/responsible-ai" },
    { label: "Security", href: "/security" },
    { label: "FAQ", href: "/faq" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-[#060b14]/90 backdrop-blur-md border-b border-[#14233a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <Brand />

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
          {navLinks.map((item) => (
            <Link
              key={item.label}
              to={item.href}
              className="hover:text-cyan-400 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTA actions */}
        <div className="hidden md:flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/login")}
            className="text-slate-200"
          >
            Sign in
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={<ArrowRight className="w-4 h-4" />}
            iconPosition="right"
            onClick={() => navigate("/register")}
          >
            Get Started
          </Button>
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 focus:outline-none"
          onClick={() => setOpen(!open)}
          aria-label="Toggle navigation menu"
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {open && (
        <div className="md:hidden bg-[#0a1424] border-b border-[#182c47] p-6 space-y-4 animate-in slide-in-from-top-4 duration-200">
          <div className="flex flex-col gap-3 text-sm font-medium text-slate-300">
            {navLinks.map((item) => (
              <Link
                key={item.label}
                to={item.href}
                onClick={() => setOpen(false)}
                className="py-2 hover:text-cyan-400"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="pt-4 border-t border-[#16273f] flex flex-col gap-3">
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                setOpen(false);
                navigate("/login");
              }}
              className="w-full justify-center"
            >
              Sign In
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setOpen(false);
                navigate("/register");
              }}
              className="w-full justify-center"
            >
              Create Account
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
