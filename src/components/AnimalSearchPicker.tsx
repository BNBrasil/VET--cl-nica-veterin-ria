import { useEffect, useMemo, useState } from 'react';
import { PawPrint, Plus, Search, X } from 'lucide-react';
import { Animal } from '../types';

interface AnimalSearchPickerProps {
  animals: Animal[];
  value: string;
  onChange: (animalId: string, animalName: string) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  onCreateAnimal?: () => void;
}

export default function AnimalSearchPicker({
  animals,
  value,
  onChange,
  label = 'Identificação do Pet',
  required = false,
  placeholder = 'Busque pelo nome do pet...',
  onCreateAnimal,
}: AnimalSearchPickerProps) {
  const selectedAnimal = useMemo(
    () => animals.find((animal) => animal.id === value),
    [animals, value]
  );
  const [search, setSearch] = useState(selectedAnimal?.name || '');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setSearch(selectedAnimal?.name || '');
  }, [selectedAnimal?.id, selectedAnimal?.name]);

  const filteredAnimals = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return animals.slice(0, 8);
    return animals
      .filter((animal) => {
        const tutorName = animal.tutor?.user?.name || '';
        return `${animal.name} ${animal.species} ${animal.breed} ${tutorName}`
          .toLowerCase()
          .includes(term);
      })
      .slice(0, 8);
  }, [animals, search]);

  const clearSelection = () => {
    setSearch('');
    setOpen(false);
    onChange('', '');
  };

  return (
    <div className="relative">
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
          <PawPrint className="h-4 w-4 text-primary-500" />
          {label}{required ? ' *' : ''}
        </label>
        {onCreateAnimal && (
          <button
            type="button"
            onClick={onCreateAnimal}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-extrabold text-emerald-700 shadow-sm transition hover:bg-emerald-100"
          >
            <Plus className="h-3 w-3" />
            Novo Pet
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setSearch(event.target.value);
            setOpen(true);
            if (value) onChange('', '');
          }}
          placeholder={placeholder}
          required={required && !value}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-28 text-sm font-semibold text-slate-700 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
        />

        {value && selectedAnimal && (
          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
            <span className="rounded-lg bg-emerald-100 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider text-emerald-700">
              Selecionado
            </span>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Limpar pet selecionado"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {open && !value && (
        <div className="absolute left-0 right-0 top-full z-[70] mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-slate-100 bg-white shadow-2xl">
          {filteredAnimals.length > 0 ? (
            filteredAnimals.map((animal) => (
              <button
                key={animal.id}
                type="button"
                onClick={() => {
                  onChange(animal.id, animal.name);
                  setSearch(animal.name);
                  setOpen(false);
                }}
                className="flex w-full flex-col border-b border-slate-50 px-4 py-3 text-left transition last:border-b-0 hover:bg-emerald-50/70"
              >
                <span className="text-sm font-black text-slate-800">{animal.name}</span>
                <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  {animal.species} • {animal.breed} • Tutor: {animal.tutor?.user?.name || 'N/A'}
                </span>
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-xs font-medium text-slate-400">
              Nenhum pet encontrado.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
