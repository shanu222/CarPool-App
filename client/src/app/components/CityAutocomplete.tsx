import { useEffect, useMemo, useRef, useState } from 'react';

interface CityAutocompleteProps {
  label: string;
  value: string;
  placeholder: string;
  icon?: React.ReactNode;
  cities: string[];
  onChange: (value: string) => void;
}

const normalize = (value: string) => value.trim().toLowerCase();

const renderHighlighted = (text: string, query: string) => {
  if (!query) {
    return text;
  }

  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) {
    return text;
  }

  const start = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const end = text.slice(index + query.length);

  return (
    <>
      {start}
      <span className="font-semibold text-blue-700">{match}</span>
      {end}
    </>
  );
};

export function CityAutocomplete({ label, value, placeholder, icon, cities, onChange }: CityAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const normalizedValue = normalize(value);

  const suggestions = useMemo(() => {
    if (!normalizedValue) {
      return cities.slice(0, 10);
    }

    return cities
      .filter((city) => normalize(city).includes(normalizedValue))
      .slice(0, 10);
  }, [cities, normalizedValue]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current) {
        return;
      }

      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-sm mb-2 text-gray-700">{label}</label>
      <div className="relative">
        {icon ? <div className="absolute left-4 top-1/2 -translate-y-1/2">{icon}</div> : null}
        <input
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              if (suggestions[0]) {
                onChange(suggestions[0]);
              }
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {open ? (
        <div className="absolute z-30 mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
          {suggestions.length > 0 ? (
            suggestions.map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => {
                  onChange(city);
                  setOpen(false);
                }}
                className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-blue-50"
              >
                {renderHighlighted(city, value)}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-600">Press Enter to use custom city</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
