import { ChevronDown, Globe2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { countries } from "../../constants/semanticModels";
import type { CountryCode } from "../../types/semantic";
import { getCountry, normalizeCountryCode } from "../../utils/semantic";

export function CountryPicker({
  countryCode,
  setCountryCode,
}: {
  countryCode: CountryCode;
  setCountryCode: (countryCode: CountryCode) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currentCountry = getCountry(countryCode);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="country-picker-wrap" ref={ref}>
      <button
        type="button"
        className="country-picker-btn"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        title={`Country: ${currentCountry.code} - ${currentCountry.name}`}
      >
        <Globe2 />
        <span className="country-selected-name">
          {currentCountry.code} - {currentCountry.name}
        </span>
        <ChevronDown className="country-chevron" />
      </button>

      {open && (
        <div className="country-menu">
          {countries.map((country) => (
            <button
              key={country.code}
              type="button"
              className={country.code === countryCode ? "selected" : ""}
              onClick={() => {
                setCountryCode(normalizeCountryCode(country.code));
                setOpen(false);
              }}
            >
              <span className="country-menu-text">
                {country.code} - {country.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
