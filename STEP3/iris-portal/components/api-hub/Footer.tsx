import { MapPin, Star } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";

export function Footer() {
  return (
    <footer className="mt-16 bg-footer text-footer-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-4">
        <div className="md:col-span-1">
          <div className="mb-4 [&_.text-brand]:text-white [&_.text-muted-foreground]:text-footer-muted">
            <Logo />
          </div>
          <p className="text-sm leading-relaxed text-footer-muted">
            Enterprise API Hub is a cloud-based service which provides standardized data
            exchange to build mutual trust and efficient collaboration.
          </p>
          <div className="mt-6 overflow-hidden rounded-lg border border-white/10">
            <div className="relative h-40 bg-[linear-gradient(135deg,#e8ecef_0%,#d5dbe0_100%)]">
              <svg viewBox="0 0 300 160" className="absolute inset-0 h-full w-full">
                <path d="M0 40 L120 30 L180 60 L300 50 L300 90 L200 100 L80 120 L0 110 Z" fill="#c9d4dc" opacity="0.7"/>
                <path d="M20 80 L280 60" stroke="#fff" strokeWidth="3" opacity="0.8"/>
                <path d="M60 20 L60 150" stroke="#fff" strokeWidth="2" opacity="0.6"/>
                <path d="M0 130 L300 120" stroke="#fff" strokeWidth="2" opacity="0.6"/>
              </svg>
              <div className="absolute left-3 top-3 max-w-[70%] rounded-md bg-white p-2 text-slate-900 shadow-md">
                <div className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 text-brand" />
                  <div className="text-[11px] leading-tight">
                    <div className="font-bold">Enterprise HQ</div>
                    <div className="flex items-center gap-1 text-slate-600">
                      <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                      4.6 (1,077)
                    </div>
                  </div>
                </div>
              </div>
              <MapPin className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-full text-brand drop-shadow" fill="currentColor" />
            </div>
          </div>
        </div>

        <div>
          <h4 className="mb-4 text-base font-semibold">Quick links</h4>
          <ul className="space-y-2.5 text-sm text-footer-muted">
            {["Home","Manage Organization","Join Organization","API Catalog","Help Center","About of Use","Privacy Policy"].map(l => (
              <li key={l}><a href="#" className="hover:text-white transition">{l}</a></li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-2">
          <h4 className="mb-4 text-base font-semibold">Contact us</h4>
          <p className="text-sm leading-relaxed text-footer-muted">
            Enterprise API Hub — Head Office<br/>
            Jl. Sudirman Kav. 25, ISTD It 4,<br/>
            Jakarta Selatan, DKI Jakarta 12920, Indonesia
          </p>
          <Button className="mt-6 h-11 rounded-md border border-white/20 bg-transparent px-8 text-sm font-bold tracking-wide text-white hover:bg-white hover:text-footer">
            CONTACT US
          </Button>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-4 text-xs text-footer-muted">
          © {new Date().getFullYear()} Enterprise API Hub. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
