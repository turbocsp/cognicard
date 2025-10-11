import { useMemo } from "react";
import { Tooltip } from "react-tooltip";
import { format, startOfYear, addDays, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";

// Componente para renderizar o mapa de calor de atividades
export function ActivityCalendar({ year, data }) {
  // Memoiza o cálculo dos dias e dados para evitar reprocessamento a cada renderização
  const { days, activityMap } = useMemo(() => {
    const startDate = startOfYear(new Date(year, 0, 1));
    const days = [];
    const activityMap = new Map(
      data.map((item) => [item.study_date, item.count])
    );

    // Gera todos os dias do ano
    for (let i = 0; i < 366; i++) {
      const date = addDays(startDate, i);
      if (date.getFullYear() === year) {
        days.push(date);
      }
    }
    return { days, activityMap };
  }, [year, data]);

  // Calcula o deslocamento para o primeiro dia do ano (para alinhar com o dia da semana)
  const firstDayOffset = getDay(days[0]);

  // Função para determinar a cor do dia com base na contagem de estudos
  const getColor = (count) => {
    if (count === 0) return "bg-gray-200 dark:bg-gray-700/60";
    if (count <= 2) return "bg-green-300 dark:bg-green-800";
    if (count <= 5) return "bg-green-500 dark:bg-green-600";
    return "bg-green-700 dark:bg-green-400";
  };

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">
        Mapa de Atividade de {year}
      </h3>
      <div className="grid grid-rows-7 grid-flow-col gap-1">
        {/* Renderiza os nomes dos dias da semana */}
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-xs text-center text-gray-500 dark:text-gray-400"
          >
            {day}
          </div>
        ))}

        {/* Células vazias para o deslocamento do primeiro dia */}
        {Array.from({ length: firstDayOffset }).map((_, index) => (
          <div key={`empty-${index}`} />
        ))}

        {/* Renderiza cada dia do ano */}
        {days.map((day) => {
          const dateString = format(day, "yyyy-MM-dd");
          const count = activityMap.get(dateString) || 0;
          const formattedDate = format(day, "d 'de' MMMM 'de' yyyy", {
            locale: ptBR,
          });
          const tooltipContent = `${count} ${
            count === 1 ? "estudo" : "estudos"
          } em ${formattedDate}`;

          return (
            <div
              key={dateString}
              className={`w-4 h-4 rounded-sm ${getColor(count)}`}
              data-tooltip-id="activity-tooltip"
              data-tooltip-content={tooltipContent}
            />
          );
        })}
      </div>
      <Tooltip id="activity-tooltip" />
    </div>
  );
}
