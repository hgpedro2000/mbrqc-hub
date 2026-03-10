import { useState } from "react";
import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface FilterConfig {
  key: string;
  label: string;
  options: string[];
}

interface MasterListFilterProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters: FilterConfig[];
  filterValues: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
}

const MasterListFilter = ({
  searchValue,
  onSearchChange,
  filters,
  filterValues,
  onFilterChange,
  onClearFilters,
}: MasterListFilterProps) => {
  const { t } = useTranslation();
  const hasActiveFilters = searchValue || Object.values(filterValues).some((v) => v && v !== "all");

  return (
    <div className="form-section space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("filter.searchPlaceholder")}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters} className="gap-1 text-muted-foreground shrink-0">
            <X className="w-3 h-3" /> {t("filter.clearFilters")}
          </Button>
        )}
      </div>
      {filters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <Select
              key={filter.key}
              value={filterValues[filter.key] || "all"}
              onValueChange={(v) => onFilterChange(filter.key, v)}
            >
              <SelectTrigger className="w-full sm:w-auto min-w-[120px] md:min-w-[140px] h-9 text-xs">
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filter.allPrefix")} — {filter.label}</SelectItem>
                {filter.options.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>
      )}
    </div>
  );
};

export default MasterListFilter;

// Helper hook for filter logic
export const useListFilters = (initialFilters: string[] = []) => {
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  const handleFilterChange = (key: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setSearch("");
    setFilterValues({});
  };

  const matchesSearch = (item: Record<string, any>, fields: string[]) => {
    if (!search) return true;
    const lower = search.toLowerCase();
    return fields.some((f) => {
      const val = item[f];
      return val && String(val).toLowerCase().includes(lower);
    });
  };

  const matchesFilters = (item: Record<string, any>) => {
    return Object.entries(filterValues).every(([key, value]) => {
      if (!value || value === "all") return true;
      return String(item[key]) === value;
    });
  };

  return { search, setSearch, filterValues, handleFilterChange, clearFilters, matchesSearch, matchesFilters };
};
