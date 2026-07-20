import { Globe2 } from "lucide-react";
import { countries } from "../../constants/semanticModels";
import type { CountryCode } from "../../types/semantic";
import { normalizeCountryCode } from "../../utils/semantic";

export function CountryPicker({
  countryCode,
  setCountryCode,
}: {
  countryCode: CountryCode;
  setCountryCode: (countryCode: CountryCode) => void;
}) {
  return (
    <label className="country-picker">
      <Globe2 />
      <select
        value={countryCode}
        onChange={(event) => setCountryCode(normalizeCountryCode(event.target.value))}
        aria-label="Country"
      >
        {countries.map((country) => (
          <option key={country.code} value={country.code}>
            {country.code} {country.name}
          </option>
        ))}
      </select>
    </label>
  );
}
